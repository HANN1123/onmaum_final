'use client'

// rPPG 실험 페이지 (메뉴 미노출).
// 추정기 3종을 같은 영상에서 나란히 비교한다:
//  - POS 이마 / POS 이마+볼: face-api 랜드마크(현행 부하 그대로: SSD+랜드마크+표정) ROI 피부 평균 RGB → POS
//  - ME-rPPG: BlazeFace(매 프레임) 얼굴 박스 → 36×36 → 워커에서 ONNX 추론 → 맥박 파형 → BPM
// 옆 사람이 스마트워치(또는 손가락 앱) BPM을 입력하면 앱 추정과 짝지어 조건별 오차를 낸다.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import * as faceapi from 'face-api.js'
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { loadFaceApiModels } from '@/features/camera/lib/faceDetection'
import {
  createFrameClock,
  estimateHeartRate,
  heartRateFromBvp,
  MAX_SAMPLE_GAP_MS,
  meanSkinRgb,
  parseLabRows,
  referenceBpm,
  roiRects,
  summarizePairs,
  type Condition,
  type HeartRate,
  type LabRow,
  type ReferenceSample,
  type Verdict,
  type Rect,
  type RgbSample,
  type RoiSet,
} from '@/features/rppg/lib/rppg'
import {
  clampCrop,
  createKalman1D,
  expandFaceBox,
  rgbaToModelInput,
  type FaceBox,
  type Kalman1D,
} from '@/features/rppg/lib/meRppg'
import {
  abortedRows,
  dueSlots,
  PREP_MS,
  rowsToCsv,
  runKey,
  SLOT_COUNT,
  SLOT_MS,
  slotRow,
  type Evaluation,
} from '@/features/rppg/lib/labProtocol'
import type { MeWorkerIn, MeWorkerOut } from '@/features/rppg/lib/meRppg.worker'
import { useHeartRateDevice } from '@/features/rppg/hooks/useHeartRateDevice'
import { getBlazeFace } from '@/features/rppg/engine/blazeFace'
import { createHrTracker, type BoxSample, type TrackedHeartRate } from '@/features/rppg/lib/hrEstimator'
import {
  DEMO_MATCH_BPM,
  DEMO_MEASURE_MS,
  DEMO_STATE_TEXT,
  DEMO_TOTAL_MS,
  demoRecordsToCsv,
  parseDemoRecords,
  WATCH_LAG_S,
  demoState,
  recentMedian,
  recordDemo,
  startDemoRun,
  summarizeDemo,
  type DemoRun,
  type DemoPoint,
  type DemoRecord,
  type DemoState,
} from '@/features/rppg/lib/demoCompare'
import { createWaveLog, logBox, logBvp, logMarker, waveLogToJson, type WaveLog } from '@/features/rppg/lib/waveLog'

const WINDOW_MS = 10_000
const BUFFER_MS = 12_000
const STALE_MS = 2_000
/** 워치 값이 이보다 오래되면 시연 비교에 쓰지 않는다 */
const WATCH_FRESH_MS = 5_000
const MIN_SKIN_RATIO = 0.3
const ROI_EMA = 0.5
const ROWS_KEY = 'onmaum_rppg_lab_rows'
/** 시연 30초 측정 결과(회차별 요약). 새로고침해도 남긴다 */
const DEMO_KEY = 'onmaum_rppg_lab_demo'
/** ME-rPPG: 처음 출력 30개는 버림 (데모와 동일 워밍업) */
const ME_WARMUP = 30
/** 워커에 쌓인 프레임이 이만큼이면 새 프레임은 건너뜀 (데모와 동일) */
const ME_MAX_IN_FLIGHT = 5

const DETECTOR_OPTIONS = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })

const CONDITIONS: { key: Condition; label: string; target: number | null }[] = [
  { key: 'quiet', label: '조용히', target: 5 },
  { key: 'talk', label: '말하며', target: 8 },
  { key: 'move', label: '움직이며', target: null },
]

const ROI_LABELS: Record<RoiSet, string> = { forehead: 'POS 이마', all: 'POS 이마+볼', me: 'ME-rPPG', fx: '튜닝 추정' }

type MeStatus = 'loading' | 'ready' | 'error'

interface Rois {
  forehead: Rect
  leftCheek: Rect
  rightCheek: Rect
}

interface Live {
  forehead: HeartRate | null
  all: HeartRate | null
  me: HeartRate | null
  /** 측정 화면 엔진과 같은 ME 버퍼·얼굴 상자 기반 튜닝 추정 */
  fx: TrackedHeartRate | null
  demo: { state: DemoState; bpm: number | null; watch: number | null }
  meLatency: number
  /** 마지막 영상 프레임 기준 ME 결과가 얼마나 지났는가 (ms) */
  meAgeMs: number | null
  meSentFps: number
  meOutFps: number
  meDropped: number
  fps: number
  skin: number
  face: boolean
}

const EMPTY_LIVE: Live = {
  forehead: null,
  all: null,
  me: null,
  fx: null,
  demo: { state: 'waiting', bpm: null, watch: null },
  meLatency: 0,
  meAgeMs: null,
  meSentFps: 0,
  meOutFps: 0,
  meDropped: 0,
  fps: 0,
  skin: 0,
  face: false,
}

function smoothRect(prev: Rect, next: Rect): Rect {
  const mix = (a: number, b: number) => a + ROI_EMA * (b - a)
  return { x: mix(prev.x, next.x), y: mix(prev.y, next.y), w: mix(prev.w, next.w), h: mix(prev.h, next.h) }
}

function sampleRoi(ctx: CanvasRenderingContext2D, rect: Rect, w: number, h: number) {
  const x = Math.max(0, Math.round(rect.x))
  const y = Math.max(0, Math.round(rect.y))
  const rw = Math.min(w - x, Math.round(rect.w))
  const rh = Math.min(h - y, Math.round(rect.h))
  if (rw < 4 || rh < 4) return null
  const m = meanSkinRgb(ctx.getImageData(x, y, rw, rh).data)
  if (!m || m.skinRatio < MIN_SKIN_RATIO) return null
  return { ...m, count: m.skinRatio * rw * rh }
}

function windowed(buf: RgbSample[]): RgbSample[] {
  if (buf.length === 0) return buf
  const from = buf[buf.length - 1].t - WINDOW_MS
  return buf.filter((s) => s.t >= from)
}

function fmt(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(digits)
}

const VERDICT_LABELS: Record<Verdict, string> = {
  pass: '목표 충족',
  fail: '목표 미달',
  undecided: '판정 불가',
  exploratory: '참고',
}

function rate(v: number, n: number): string {
  return n > 0 ? `${Math.round(v * 100)}%` : '—'
}

function downloadText(text: string, prefix: string, ext: 'csv' | 'json' = 'csv') {
  const blob = new Blob([text], { type: ext === 'csv' ? 'text/csv' : 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${prefix}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}

function rawReferenceCsv(samples: ReferenceSample[]): string {
  const lines = samples.map((s) => `${(s.t / 1000).toFixed(3)},${s.bpm},${s.contact}`)
  return ['received_s,bpm,contact', ...lines].join('\n')
}

export function RppgLab() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const [modelReady, setModelReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectMs, setDetectMs] = useState(500)
  const [meEnabled, setMeEnabled] = useState(true)
  const [meStatus, setMeStatus] = useState<MeStatus>('loading')
  const [condition, setCondition] = useState<Condition>('quiet')
  const [conditionStart, setConditionStart] = useState(0)
  const [clock, setClock] = useState(0)
  const [gateDb, setGateDb] = useState(0)
  const [live, setLive] = useState<Live>(EMPTY_LIVE)
  const [rows, setRows] = useState<LabRow[]>([])
  const [rowsLoaded, setRowsLoaded] = useState(false)
  const [watchInput, setWatchInput] = useState('')
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)

  const heartRate = useHeartRateDevice()
  const { getSamples } = heartRate
  const evaluationRef = useRef<Evaluation | null>(null)
  const runIdRef = useRef('')
  const evaluationCountRef = useRef(0)
  /** 조건이 바뀌면 이전 조건의 ME 내부 상태가 결과에 남지 않게 다음 프레임에서 초기화한다 */
  const meResetRequestRef = useRef(false)
  const liveRef = useRef<Live>(EMPTY_LIVE)
  const detectMsRef = useRef(detectMs)
  const startRef = useRef(0)
  /** 이번 측정의 원시 파형 기록(파형 저장 버튼으로 내보낸다) */
  const waveRef = useRef<WaveLog | null>(null)
  const [hasWave, setHasWave] = useState(false)
  /** 시연: 30초 측정 진행(시작 시각과 1초 칸) · 끝난 결과 */
  const demoRunRef = useRef<DemoRun | null>(null)
  const [demoRun, setDemoRun] = useState<{ start: number; seconds: number } | null>(null)
  const [demoResults, setDemoResults] = useState<DemoRecord[]>([])
  const [demoLoaded, setDemoLoaded] = useState(false)
  /** 진행 중인 시연 측정의 시작 정보(결과에 붙인다) */
  const demoMetaRef = useRef<{ startedAt: string; startS: number } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEMO_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDemoResults(parseDemoRecords(saved))
    } catch {
      // 저장소 접근 불가 — 메모리에서만 유지
    }
    setDemoLoaded(true)
  }, [])

  useEffect(() => {
    if (!demoLoaded) return
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(demoResults))
    } catch {
      // 무시
    }
  }, [demoResults, demoLoaded])

  useEffect(() => {
    detectMsRef.current = detectMs
  }, [detectMs])

  useEffect(() => {
    let cancelled = false
    loadFaceApiModels()
      .then(() => {
        if (!cancelled) setModelReady(true)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(`모델 로드 실패: ${err instanceof Error ? err.message : String(err)}`)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 새로고침해도 측정 기록이 날아가지 않게 (localStorage는 mount 후 — hydration mismatch 방지)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROWS_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setRows(parseLabRows(saved))
    } catch {
      // 저장소 접근 불가 — 메모리에서만 유지
    }
    setRowsLoaded(true)
  }, [])

  useEffect(() => {
    if (!rowsLoaded) return
    try {
      localStorage.setItem(ROWS_KEY, JSON.stringify(rows))
    } catch {
      // 무시
    }
  }, [rows, rowsLoaded])

  useEffect(() => {
    const id = setInterval(() => setClock(performance.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!running) return
    const video = videoRef.current
    const overlay = overlayRef.current
    if (!video || !overlay) return

    let stopped = false
    let stream: MediaStream | null = null
    let estimateTimer: ReturnType<typeof setInterval> | undefined
    let rois: Rois | null = null
    let skin = 0
    let face = false
    const frameClock = createFrameClock()
    const buffers: { forehead: RgbSample[]; all: RgbSample[] } = { forehead: [], all: [] }
    const frameWalls: number[] = []

    // ── ME-rPPG ──
    let worker: Worker | null = null
    let blaze: FaceDetector | null = null
    let meReady = false
    let meInFlight = 0
    let meOutputs = 0
    let meBox: FaceBox | null = null
    let meKalman: Kalman1D[] | null = null
    let meLastSendT: number | null = null
    let meEpoch = 0
    let meDropped = 0
    const meBuffer: { t: number; v: number }[] = []
    const meLatencies: number[] = []
    const meOutWalls: number[] = []
    const meSentWalls: number[] = []
    const boxBuf: BoxSample[] = []
    const tracker = createHrTracker()
    const demoPoints: DemoPoint[] = []

    /** 실패한 프레임은 응답이 오지 않아 전송 수가 어긋난다. 이번 실행은 끝내고 다시 시작하게 한다 */
    const failMe = (message: string) => {
      worker?.terminate()
      worker = null
      meReady = false
      setMeStatus('error')
      setError(message)
    }

    /** 끊긴 뒤에는 모델 상태·칼만·파형을 모두 버리고 새로 시작한다. 이전 프레임의 늦은 응답은 epoch로 거른다 */
    const resetMe = () => {
      meEpoch++
      meInFlight = 0
      meOutputs = 0
      meKalman = null
      meBuffer.length = 0
      boxBuf.length = 0
      tracker.reset()
      demoPoints.length = 0
      const msg: MeWorkerIn = { type: 'reset' }
      worker?.postMessage(msg)
    }

    if (meEnabled) {
      worker = new Worker(new URL('../lib/meRppg.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<MeWorkerOut>) => {
        const m = e.data
        if (m.type === 'ready') {
          meReady = true
          if (blaze) setMeStatus('ready')
        } else if (m.type === 'error') {
          failMe(m.message)
        } else {
          if (m.epoch !== meEpoch) return
          meInFlight--
          meOutputs++
          meLatencies.push(m.latency)
          if (meLatencies.length > 60) meLatencies.shift()
          const wall = performance.now()
          meOutWalls.push(wall)
          while (meOutWalls.length > 0 && meOutWalls[0] < wall - 2000) meOutWalls.shift()
          if (waveRef.current) logBvp(waveRef.current, 'me', m.t, m.value)
          if (meOutputs <= ME_WARMUP) return
          meBuffer.push({ t: m.t, v: m.value })
          while (meBuffer.length > 0 && meBuffer[0].t < m.t - BUFFER_MS) meBuffer.shift()
        }
      }
      worker.onerror = (e) => failMe(`ME-rPPG worker 오류: ${e.message}`)
      getBlazeFace()
        .then((d) => {
          if (stopped) return
          blaze = d
          if (meReady) setMeStatus('ready')
        })
        .catch((err: unknown) => {
          setMeStatus('error')
          setError(`BlazeFace 로드 실패: ${err instanceof Error ? err.message : String(err)}`)
        })
    }

    const drawOverlay = () => {
      const octx = overlay.getContext('2d')
      if (!octx) return
      octx.clearRect(0, 0, overlay.width, overlay.height)
      if (meBox) {
        octx.setLineDash([8, 6])
        octx.lineWidth = 2
        octx.strokeStyle = '#737373'
        octx.strokeRect(meBox.originX, meBox.originY, meBox.width, meBox.height)
        octx.setLineDash([])
      }
      if (!rois) return
      octx.lineWidth = 3
      octx.strokeStyle = '#6BAB9A'
      const f = rois.forehead
      octx.strokeRect(f.x, f.y, f.w, f.h)
      octx.strokeStyle = '#D4A84B'
      for (const c of [rois.leftCheek, rois.rightCheek]) octx.strokeRect(c.x, c.y, c.w, c.h)
    }

    const run = async () => {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      })
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      await video.play()
      if (stopped) return

      const w = video.videoWidth
      const h = video.videoHeight
      overlay.width = w
      overlay.height = h
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const crop = document.createElement('canvas')
      crop.width = 36
      crop.height = 36
      const cropCtx = crop.getContext('2d', { willReadFrequently: true })
      if (!ctx || !cropCtx) throw new Error('캔버스를 만들 수 없어요')
      cropCtx.imageSmoothingEnabled = true
      cropCtx.imageSmoothingQuality = 'high'
      startRef.current = performance.now()
      waveRef.current = createWaveLog(startRef.current)
      setHasWave(true)
      runIdRef.current = `run-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`

      // POS용 얼굴 위치: face-api (현행 측정과 같은 부하)
      const detectLoop = async () => {
        while (!stopped) {
          try {
            const det = await faceapi
              .detectSingleFace(video, DETECTOR_OPTIONS)
              .withFaceLandmarks()
              .withFaceExpressions()
            if (stopped) break
            if (det) {
              const next = roiRects(det.landmarks.positions)
              rois = rois
                ? {
                    forehead: smoothRect(rois.forehead, next.forehead),
                    leftCheek: smoothRect(rois.leftCheek, next.leftCheek),
                    rightCheek: smoothRect(rois.rightCheek, next.rightCheek),
                  }
                : next
              face = true
            } else {
              rois = null
              face = false
            }
          } catch (err) {
            console.error('얼굴 검출 실패:', err)
          }
          await new Promise((r) => setTimeout(r, detectMsRef.current))
        }
      }

      // ME-rPPG: BlazeFace 박스 → 칼만 → 높이 1.2배·위로 20% → 36×36 → 워커
      const sendMeFrame = (now: number, t: number) => {
        if (!worker || !blaze || !meReady) return
        if (meInFlight >= ME_MAX_IN_FLIGHT) {
          meDropped++
          return
        }
        const det = blaze.detectForVideo(video, now).detections[0]?.boundingBox
        if (!det) {
          meBox = null
          return
        }
        // 끊겼다 돌아오면 파형만 비우지 않고 모델 상태까지 새로 시작한다. 기준은 신호처리의 공백과 같다
        if (meResetRequestRef.current || (meLastSendT !== null && t - meLastSendT > MAX_SAMPLE_GAP_MS)) {
          meResetRequestRef.current = false
          resetMe()
        }
        if (!meKalman) {
          meKalman = [det.originX, det.originY, det.width, det.height].map((v) => createKalman1D(1e-2, 5e-1, v, 1))
        }
        const [kx, ky, kw, kh] = meKalman
        const box = expandFaceBox({
          originX: kx.update(det.originX),
          originY: ky.update(det.originY),
          width: kw.update(det.width),
          height: kh.update(det.height),
        })
        meBox = box
        boxBuf.push({ t, cx: box.originX + box.width / 2, cy: box.originY + box.height / 2, w: box.width })
        while (boxBuf.length > 0 && boxBuf[0].t < t - BUFFER_MS) boxBuf.shift()
        if (waveRef.current) logBox(waveRef.current, t, box.originX + box.width / 2, box.originY + box.height / 2, box.width)
        const c = clampCrop(box, w, h)
        if (!c) return
        cropCtx.drawImage(canvas, c.sx, c.sy, c.sw, c.sh, 0, 0, 36, 36)
        const input = rgbaToModelInput(cropCtx.getImageData(0, 0, 36, 36).data)
        meLastSendT = t
        meInFlight++
        meSentWalls.push(now)
        while (meSentWalls.length > 0 && meSentWalls[0] < now - 2000) meSentWalls.shift()
        const msg: MeWorkerIn = { type: 'frame', input, t, epoch: meEpoch }
        worker.postMessage(msg, [input.buffer])
      }

      // 매 프레임: 원본을 한 번 그려서 POS ROI 샘플링 + ME-rPPG 입력에 같이 씀
      const onFrame = (now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
        if (stopped) return
        const t = frameClock.next(now, meta.captureTime)
        if (t !== null) {
          ctx.drawImage(video, 0, 0, w, h)
          if (rois) {
            const f = sampleRoi(ctx, rois.forehead, w, h)
            const parts = [f, sampleRoi(ctx, rois.leftCheek, w, h), sampleRoi(ctx, rois.rightCheek, w, h)].filter(
              (p): p is NonNullable<typeof p> => p !== null,
            )
            if (f) buffers.forehead.push({ t, r: f.r, g: f.g, b: f.b })
            if (parts.length > 0) {
              const total = parts.reduce((s, p) => s + p.count, 0)
              buffers.all.push({
                t,
                r: parts.reduce((s, p) => s + p.r * p.count, 0) / total,
                g: parts.reduce((s, p) => s + p.g * p.count, 0) / total,
                b: parts.reduce((s, p) => s + p.b * p.count, 0) / total,
              })
            }
            skin = f?.skinRatio ?? 0
            for (const buf of [buffers.forehead, buffers.all]) {
              while (buf.length > 0 && buf[0].t < t - BUFFER_MS) buf.shift()
            }
          }
          sendMeFrame(now, t)
          drawOverlay()
          frameWalls.push(now)
          while (frameWalls.length > 0 && frameWalls[0] < now - 2000) frameWalls.shift()
        }
        video.requestVideoFrameCallback(onFrame)
      }
      video.requestVideoFrameCallback(onFrame)
      void detectLoop()

      estimateTimer = setInterval(() => {
        const nowWall = performance.now()
        // 신선도는 응답 도착이 아니라 원본 프레임의 시각으로 판단한다
        const fresh = (buf: { t: number }[]) => buf.length > 0 && nowWall - buf[buf.length - 1].t < STALE_MS
        while (frameWalls.length > 0 && frameWalls[0] < nowWall - 2000) frameWalls.shift()
        while (meOutWalls.length > 0 && meOutWalls[0] < nowWall - 2000) meOutWalls.shift()
        while (meSentWalls.length > 0 && meSentWalls[0] < nowWall - 2000) meSentWalls.shift()
        const meLast = meBuffer[meBuffer.length - 1]
        const fx = worker && fresh(meBuffer) ? tracker.estimate([meBuffer], boxBuf) : null
        // 시연: 움직임·약한 신호가 아닐 때만 값을 모아 최근 5초 중앙값을 보여 준다
        const dState = demoState(fx)
        if (fx && dState === 'ok') demoPoints.push({ t: nowWall, bpm: fx.bpm })
        while (demoPoints.length > 0 && demoPoints[0].t < nowWall - 60_000) demoPoints.shift()
        const dBpm = dState === 'ok' ? recentMedian(demoPoints, nowWall) : null
        const lastWatch = getSamples().at(-1)
        // 접촉 불량 값은 기준으로 쓰지 않는다(referenceBpm 과 같은 규칙)
        const dWatch = lastWatch && lastWatch.contact !== 'poor' && nowWall - lastWatch.t < WATCH_FRESH_MS ? lastWatch.bpm : null
        const run = demoRunRef.current
        if (run) {
          if (recordDemo(run, nowWall, dWatch, dBpm)) {
            const meta = demoMetaRef.current ?? { startedAt: new Date().toISOString(), startS: 0 }
            const record: DemoRecord = { ...summarizeDemo(run.slots, run.lagWatch), ...meta, lagS: WATCH_LAG_S }
            demoRunRef.current = null
            demoMetaRef.current = null
            if (waveRef.current) logMarker(waveRef.current, nowWall, 'demo:end')
            setDemoRun(null)
            setDemoResults((rs) => [...rs, record])
          } else setDemoRun({ start: run.start, seconds: Math.min(DEMO_TOTAL_MS / 1000, Math.floor((nowWall - run.start) / 1000)) })
        }
        const next: Live = {
          forehead: fresh(buffers.forehead) ? estimateHeartRate(windowed(buffers.forehead)) : null,
          all: fresh(buffers.all) ? estimateHeartRate(windowed(buffers.all)) : null,
          me: fresh(meBuffer) ? heartRateFromBvp(meBuffer) : null,
          fx,
          demo: { state: dState, bpm: dBpm, watch: dWatch },
          meLatency: meLatencies.length ? meLatencies.reduce((s, v) => s + v, 0) / meLatencies.length : 0,
          meAgeMs: meLast ? nowWall - meLast.t : null,
          meSentFps: meSentWalls.length / 2,
          meOutFps: meOutWalls.length / 2,
          meDropped,
          fps: frameWalls.length / 2,
          skin,
          face,
        }
        liveRef.current = next
        setLive(next)

        const current = evaluationRef.current
        if (!current) return
        const due = dueSlots(current, nowWall)
        if (due.length === 0) return
        const slotRows = due.map((slot) =>
          slotRow({
            evaluation: current,
            slot,
            now: nowWall,
            startedAt: startRef.current,
            estimates: { forehead: next.forehead, all: next.all, me: next.me, fx: next.fx },
            fxMotion: next.fx?.motion ?? null,
            reference: referenceBpm(getSamples(), current.evalStart + slot * SLOT_MS),
            fps: next.fps,
            meOutFps: next.meOutFps,
            meDropped: next.meDropped,
          }),
        )
        setRows((rs) => [...rs, ...slotRows])
        const nextSlot = due[due.length - 1] + 1
        const updated = nextSlot > SLOT_COUNT ? null : { ...current, nextSlot }
        evaluationRef.current = updated
        setEvaluation(updated)
      }, 1000)
    }

    run().catch((err: unknown) => {
      if (stopped) return
      setError(`카메라 실패: ${err instanceof Error ? err.message : String(err)}`)
      setRunning(false)
    })

    return () => {
      stopped = true
      if (estimateTimer) clearInterval(estimateTimer)
      const interrupted = evaluationRef.current
      if (interrupted) {
        const startedAt = startRef.current
        setRows((rs) => [...rs, ...abortedRows(interrupted, startedAt)])
        evaluationRef.current = null
        setEvaluation(null)
      }
      stream?.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)
      worker?.terminate()
      if (demoRunRef.current && waveRef.current) logMarker(waveRef.current, performance.now(), 'demo:cancel')
      demoRunRef.current = null
      demoMetaRef.current = null
      setDemoRun(null)
      liveRef.current = EMPTY_LIVE
      setLive(EMPTY_LIVE)
      setMeStatus('loading')
    }
  }, [running, meEnabled, getSamples])

  // 이벤트 timeStamp는 performance.now()와 같은 기준 시각
  const handleCondition = (c: Condition, at: number) => {
    meResetRequestRef.current = true
    if (waveRef.current) logMarker(waveRef.current, at, `condition:${c}`)
    setCondition(c)
    setConditionStart(at)
  }

  const handleWatch = (e: FormEvent) => {
    e.preventDefault()
    const v = Number(watchInput)
    if (!Number.isFinite(v) || v < 30 || v > 220) return
    const l = liveRef.current
    setRows((rs) => [
      ...rs,
      {
        runId: runIdRef.current || undefined,
        source: 'manual',
        slot: null,
        originMs: startRef.current,
        t: (performance.now() - startRef.current) / 1000,
        condition,
        watch: v,
        forehead: l.forehead,
        all: l.all,
        me: l.me,
        fx: l.fx,
        fxMotion: l.fx?.motion ?? null,
        fps: l.fps,
      },
    ])
    setWatchInput('')
  }

  const startEvaluation = () => {
    evaluationCountRef.current++
    const next: Evaluation = {
      // 반복 평가가 한 실행으로 합쳐지지 않게 평가마다 따로 이름을 붙인다
      runId: `${runIdRef.current}-${condition}-${evaluationCountRef.current}`,
      condition,
      gateDb,
      evalStart: performance.now() + PREP_MS,
      nextSlot: 1,
    }
    meResetRequestRef.current = true
    if (waveRef.current) logMarker(waveRef.current, next.evalStart, `eval:${next.runId}`)
    evaluationRef.current = next
    setEvaluation(next)
  }

  const runKeys = useMemo(() => [...new Set(rows.map(runKey))], [rows])
  const activeRun = selectedRun !== null && runKeys.includes(selectedRun) ? selectedRun : (runKeys.at(-1) ?? null)
  const runRows = useMemo(() => rows.filter((r) => runKey(r) === activeRun), [rows, activeRun])

  const prepLeft = evaluation ? Math.ceil((evaluation.evalStart - clock) / 1000) : 0
  const lastReceived = heartRate.latest ? Math.max(0, Math.round((clock - heartRate.latest.t) / 1000)) : null

  // 자동 평가는 시작할 때 고정한 게이트로 판정하고, 슬롯이 다 차기 전에는 판정하지 않는다
  const autoRun = runRows.some((r) => r.source === 'ble')
  const activeGate = runRows.find((r) => r.gateDb !== undefined)?.gateDb ?? gateDb
  const summary = summarizePairs(runRows, activeGate, autoRun ? SLOT_COUNT : 1)
  const visibleConditions = CONDITIONS.filter((c) => runRows.length === 0 || summary[c.key].me.n > 0)
  const elapsed = conditionStart > 0 ? Math.max(0, Math.floor((clock - conditionStart) / 1000)) : 0
  const meStatusLabel: Record<MeStatus, string> = {
    loading: '로딩 중',
    ready: `추론 ${fmt(live.meLatency)}ms`,
    error: '오류',
  }
  const meStatusText = running && meEnabled ? meStatusLabel[meStatus] : '꺼짐'

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto w-full max-w-2xl space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">실험 화면 · 메뉴 미노출</p>
          <h1 className="text-2xl font-bold text-ink-900">rPPG 실험실</h1>
          <p className="mt-1 text-sm text-ink-500">
            워치(또는 휴대폰 손가락 심박 앱)를 기준으로, 옆 사람이 15초마다 BPM을 입력하세요. 조건별로 2분씩.
          </p>
        </header>

        {error && <p className="rounded-lg bg-risk-warning/10 p-3 text-sm text-risk-warning">{error}</p>}
        {heartRate.error && (
          <p className="rounded-lg bg-risk-warning/10 p-3 text-sm text-risk-warning">{heartRate.error}</p>
        )}

        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-ink-900">
          <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        </div>
        <p className="-mt-3 text-xs text-ink-400">
          초록·노랑 사각형 = POS 이마·볼 영역 / 회색 점선 = ME-rPPG 얼굴 박스
        </p>

        <DemoPanel
          live={live.demo}
          running={running}
          watchConnected={heartRate.status === 'connected'}
          blocked={evaluation !== null}
          run={demoRun}
          results={demoResults}
          onExport={() => downloadText(demoRecordsToCsv(demoResults), 'rppg-lab-demo')}
          onClear={() => setDemoResults([])}
          onStart={() => {
            const start = performance.now()
            demoRunRef.current = startDemoRun(start)
            demoMetaRef.current = { startedAt: new Date().toISOString(), startS: (start - startRef.current) / 1000 }
            if (waveRef.current) logMarker(waveRef.current, start, `demo:start:${demoResults.length + 1}`)
            setDemoRun({ start, seconds: 0 })
          }}
          onCancel={() => {
            if (waveRef.current) logMarker(waveRef.current, performance.now(), 'demo:cancel')
            demoRunRef.current = null
            demoMetaRef.current = null
            setDemoRun(null)
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!modelReady}
            onClick={() => {
              setError(null)
              setRunning((r) => !r)
            }}
            className="rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {!modelReady ? '모델 로딩 중…' : running ? '정지' : '측정 시작'}
          </button>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            얼굴 검출 간격
            <select
              value={detectMs}
              onChange={(e) => setDetectMs(Number(e.target.value))}
              className="rounded border border-ink-300 px-2 py-1"
            >
              <option value={500}>500ms (현행)</option>
              <option value={200}>200ms</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" disabled={demoRun !== null || evaluation !== null} checked={meEnabled} onChange={(e) => setMeEnabled(e.target.checked)} />
            ME-rPPG 같이 돌리기
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="POS 이마" value={fmt(live.forehead?.bpm, 0)} sub={`SNR ${fmt(live.forehead?.snrDb)} dB`} />
          <Stat label="POS 이마+볼" value={fmt(live.all?.bpm, 0)} sub={`SNR ${fmt(live.all?.snrDb)} dB`} />
          <Stat
            label="ME-rPPG"
            value={fmt(live.me?.bpm, 0)}
            sub={`SNR ${fmt(live.me?.snrDb)} dB · ${meStatusText}`}
          />
          <Stat
            label="ME 처리"
            value={`${fmt(live.meOutFps, 0)} fps`}
            sub={`전송 ${fmt(live.meSentFps, 0)} fps · 결과 나이 ${live.meAgeMs === null ? '—' : Math.round(live.meAgeMs)}ms · 건너뜀 ${live.meDropped}`}
          />
          <Stat
            label="튜닝 추정"
            value={fmt(live.fx?.bpm, 0)}
            sub={`SNR ${fmt(live.fx?.snrDb)} dB · 흔들림 ${live.fx?.motion == null ? '—' : `${(live.fx.motion * 100).toFixed(1)}%`}`}
          />
          <Stat label="처리 fps" value={fmt(live.fps, 0)} sub="목표 ≈ 30" />
          <Stat
            label="얼굴 / 이마 피부"
            value={live.face ? '감지' : '없음'}
            sub={`피부 비율 ${Math.round(live.skin * 100)}%`}
          />
          <Stat label="BPM 단위" value="분당" sub="10초 창 · 1초마다 갱신" />
        </div>

        <div className="space-y-3 rounded-xl border border-ink-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">심박 기기</p>
              <p className="text-xs text-ink-500">
                {!heartRate.supported
                  ? '이 브라우저는 Web Bluetooth를 지원하지 않아요. Chrome에서 열거나 아래에 직접 입력하세요'
                  : heartRate.status === 'connected'
                    ? `${heartRate.deviceName} · ${heartRate.latest ? `${heartRate.latest.bpm} BPM · ${lastReceived}초 전 수신` : '첫 값을 기다리는 중'}`
                    : '표준 심박 센서로 방송 중인 기기를 연결하세요'}
              </p>
            </div>
            {heartRate.status === 'connected' ? (
              <button
                type="button"
                onClick={heartRate.disconnect}
                className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm"
              >
                연결 해제
              </button>
            ) : (
              <button
                type="button"
                disabled={!heartRate.supported || heartRate.status === 'connecting'}
                onClick={() => void heartRate.connect()}
                className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {heartRate.status === 'connecting' ? '연결 중…' : '심박 기기 연결'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-ink-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={evaluation !== null || demoRun !== null}
                onClick={(e) => handleCondition(c.key, e.timeStamp)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  condition === c.key ? 'bg-risk-good text-white' : 'bg-ink-100 text-ink-600'
                }`}
              >
                {c.label}
              </button>
            ))}
            <span className="ml-auto font-mono text-sm text-ink-500">
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!running || heartRate.status !== 'connected' || evaluation !== null || demoRun !== null}
              onClick={startEvaluation}
              className="rounded-lg bg-risk-good px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              자동 평가 시작
            </button>
            <span className="text-sm text-ink-500">
              {evaluation === null
                ? `준비 ${PREP_MS / 1000}초 뒤 ${SLOT_MS / 1000}초마다 ${SLOT_COUNT}회 기록해요`
                : prepLeft > 0
                  ? `준비 중 ${prepLeft}초`
                  : `평가 중 ${evaluation.nextSlot - 1}/${SLOT_COUNT} · 다른 탭으로 옮기지 마세요`}
            </span>
          </div>
          <form onSubmit={handleWatch} className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={watchInput}
              onChange={(e) => setWatchInput(e.target.value)}
              placeholder="기준 BPM 입력 후 Enter"
              className="flex-1 rounded-lg border border-ink-300 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-lg bg-risk-good px-4 py-2 text-sm font-semibold text-white">
              기록
            </button>
          </form>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-ink-900">조건별 오차 (기준 기기 대비)</h2>
            {runKeys.length > 0 && (
              <select
                value={activeRun ?? ''}
                onChange={(e) => setSelectedRun(e.target.value)}
                className="rounded border border-ink-300 px-2 py-1 text-sm"
              >
                {runKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            )}
            <label className="ml-auto flex items-center gap-2 text-sm text-ink-600">
              품질 게이트 SNR ≥
              <input
                type="number"
                step={0.5}
                value={gateDb}
                disabled={evaluation !== null || demoRun !== null}
                onChange={(e) => setGateDb(Number(e.target.value))}
                className="w-16 rounded border border-ink-300 px-2 py-1"
              />
              dB
            </label>
          </div>
          <p className="text-xs text-ink-400">
            {autoRun && `이 평가의 게이트는 시작할 때 고정한 ${activeGate} dB예요. `}
            이 장비와 이 참여자에서 애플워치와 얼마나 일치했는지를 보는 값이에요. 임상 정확도가 아니고, 15초 간격 슬롯은
            독립 표본이 아니에요.
          </p>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-ink-500">
                <th className="py-2">조건</th>
                <th>추정기</th>
                <th>슬롯</th>
                <th>rPPG 유효</th>
                <th>기준값</th>
                <th>비교 가능</th>
                <th>평균오차</th>
                <th>게이트 통과율</th>
                <th>통과 구간 오차</th>
                <th>목표</th>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              {visibleConditions.flatMap((c) =>
                (['forehead', 'all', 'me', 'fx'] as const).map((roi) => {
                  const s = summary[c.key][roi]
                  return (
                    <tr key={`${c.key}-${roi}`} className="border-b border-ink-100">
                      <td className="py-2">{c.label}</td>
                      <td>{ROI_LABELS[roi]}</td>
                      <td>{s.n}</td>
                      <td>{rate(s.rppgRate, s.n)}</td>
                      <td>{rate(s.refRate, s.n)}</td>
                      <td>{rate(s.comparableRate, s.n)}</td>
                      <td>{fmt(s.mae)}</td>
                      <td>{rate(s.coverage, s.n)}</td>
                      <td>{fmt(s.gatedMae)}</td>
                      <td>{c.target === null ? '참고' : `≤ ${c.target}`}</td>
                      <td>{VERDICT_LABELS[s.verdict]}</td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadText(rowsToCsv(rows), 'rppg-lab')}
              disabled={rows.length === 0}
              className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              CSV 저장 ({rows.length}행)
            </button>
            <button
              type="button"
              onClick={() => downloadText(rawReferenceCsv(heartRate.getRawLog()), 'rppg-lab-ble-raw')}
              className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm"
            >
              심박 기기 원시값 저장
            </button>
            <button
              type="button"
              onClick={() => waveRef.current && downloadText(waveLogToJson(waveRef.current, heartRate.getRawLog()), 'rppg-lab-wave', 'json')}
              disabled={!hasWave}
              className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              파형 저장
            </button>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.slice(0, -1))}
              disabled={rows.length === 0}
              className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              마지막 행 취소
            </button>
            <button
              type="button"
              onClick={() => setRows([])}
              disabled={rows.length === 0}
              className="ml-auto rounded-lg border border-risk-warning/40 px-3 py-1.5 text-sm text-risk-warning disabled:opacity-40"
            >
              전체 초기화
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-ink-200 p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-2xl font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-400">{sub}</p>
    </div>
  )
}

/** 시연 패널: 워치와 rPPG 숫자를 크게 나란히 보여 주고, 가만히 30초 측정 결과를 쌓는다 */
function DemoPanel({
  live,
  running,
  watchConnected,
  blocked,
  run,
  results,
  onStart,
  onCancel,
  onExport,
  onClear,
}: {
  live: Live['demo']
  running: boolean
  watchConnected: boolean
  /** 자동 평가 중이면 시연 측정을 시작하지 않는다 */
  blocked: boolean
  /** seconds = 시작 뒤 지난 초(워치 지연 보정용 추가 시간 포함) */
  run: { start: number; seconds: number } | null
  results: DemoRecord[]
  onStart: () => void
  onCancel: () => void
  onExport: () => void
  onClear: () => void
}) {
  const diff = live.bpm !== null && live.watch !== null ? live.bpm - live.watch : null
  const last = results.at(-1)
  const measureS = DEMO_MEASURE_MS / 1000
  const avg = (pick: (r: DemoRecord) => number | null | undefined) => {
    const xs = results.map(pick).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
    return xs.length ? (xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(1) : '—'
  }
  const lastText = (r: DemoRecord) => {
    const cover = `rPPG 표시 ${Math.round(r.coverage * 100)}%`
    if (r.meanAbsDiff === null) return `비교할 값이 없었어요 · ${cover}`
    const lag = r.lag?.meanAbsDiff != null ? ` (워치 지연 보정 ${r.lag.meanAbsDiff.toFixed(1)})` : ''
    return `평균 차이 ${r.meanAbsDiff.toFixed(1)} BPM${lag} · ${DEMO_MATCH_BPM} BPM 이내 ${Math.round((r.matchRate ?? 0) * 100)}% · ${cover} · 워치 ${r.watchMean?.toFixed(0)} / rPPG ${r.rppgMean?.toFixed(0)}`
  }
  return (
    <div className="space-y-3 rounded-xl border border-ink-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink-900">시연: 워치 vs rPPG</p>
        <p className={`text-xs ${live.state === 'ok' ? 'text-risk-good' : 'text-ink-500'}`}>
          {running ? DEMO_STATE_TEXT[live.state] : '측정 시작을 누르세요'}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-ink-500">워치</p>
          <p className="text-4xl font-bold text-ink-900">{live.watch === null ? '—' : Math.round(live.watch)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500">rPPG (카메라)</p>
          <p className="text-4xl font-bold text-ink-900">{live.bpm === null ? '—' : Math.round(live.bpm)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500">차이</p>
          <p className="text-4xl font-bold text-ink-900">
            {diff === null ? '—' : `${diff > 0 ? '+' : ''}${Math.round(diff)}`}
          </p>
        </div>
      </div>
      <p className="text-xs text-ink-400">워치는 심박을 몇 초 평균해 보내서 약 {WATCH_LAG_S}초 늦게 바뀌어요.</p>
      <div className="flex flex-wrap items-center gap-3">
        {run ? (
          <>
            <span className="text-sm text-ink-600">
              {run.seconds < measureS
                ? `가만히 계세요 · ${measureS - run.seconds}초 남음`
                : `워치 지연 보정값 받는 중 · ${Math.max(0, DEMO_TOTAL_MS / 1000 - run.seconds)}초`}
            </span>
            <button type="button" onClick={onCancel} className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm">
              취소
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!running || !watchConnected || blocked}
            onClick={onStart}
            className="rounded-lg bg-risk-good px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            30초 측정
          </button>
        )}
        {last && !run && <span className="text-sm text-ink-600">{lastText(last)}</span>}
      </div>
      {results.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span>
            지금까지 {results.length}회 · 평균 차이 {avg((r) => r.meanAbsDiff)} BPM (지연 보정 {avg((r) => r.lag?.meanAbsDiff)}) ·
            rPPG 표시 {avg((r) => r.coverage * 100)}%
          </span>
          <button type="button" onClick={onExport} className="rounded border border-ink-300 px-2 py-1">
            시연 결과 CSV
          </button>
          <button
            type="button"
            disabled={run !== null}
            onClick={onClear}
            className="rounded border border-ink-300 px-2 py-1 disabled:opacity-40"
          >
            시연 기록 지우기
          </button>
        </div>
      )}
    </div>
  )
}
