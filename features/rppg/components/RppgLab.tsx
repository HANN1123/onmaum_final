'use client'

// rPPG spike 실험 페이지 (메뉴 미노출, 검증 후 폐기 예정).
// 추정기 3종을 같은 영상에서 나란히 비교한다:
//  - POS 이마 / POS 이마+볼: face-api 랜드마크(현행 부하 그대로: SSD+랜드마크+표정) ROI 피부 평균 RGB → POS
//  - ME-rPPG: BlazeFace(매 프레임) 얼굴 박스 → 36×36 → 워커에서 ONNX 추론 → 맥박 파형 → BPM
// 옆 사람이 스마트워치(또는 손가락 앱) BPM을 입력하면 앱 추정과 짝지어 조건별 오차를 낸다.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import * as faceapi from 'face-api.js'
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { loadFaceApiModels } from '@/features/camera/lib/faceDetection'
import {
  estimateHeartRate,
  heartRateFromBvp,
  meanSkinRgb,
  roiRects,
  summarizePairs,
  type Condition,
  type HeartRate,
  type PairRow,
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
import type { MeWorkerIn, MeWorkerOut } from '@/features/rppg/lib/meRppg.worker'

const WINDOW_MS = 10_000
const BUFFER_MS = 12_000
const STALE_MS = 2_000
const MIN_SKIN_RATIO = 0.3
const ROI_EMA = 0.5
const ROWS_KEY = 'onmaum_rppg_lab_rows'
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

const ROI_LABELS: Record<RoiSet, string> = { forehead: 'POS 이마', all: 'POS 이마+볼', me: 'ME-rPPG' }

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
  meLatency: number
  fps: number
  skin: number
  face: boolean
}

type LabRow = PairRow & { t: number; fps: number }

const EMPTY_LIVE: Live = { forehead: null, all: null, me: null, meLatency: 0, fps: 0, skin: 0, face: false }

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

function toCsv(rows: LabRow[]): string {
  const head = 't_s,condition,watch_bpm,forehead_bpm,forehead_snr_db,all_bpm,all_snr_db,me_bpm,me_snr_db,fps'
  const lines = rows.map((r) =>
    [
      r.t.toFixed(1),
      r.condition,
      r.watch,
      fmt(r.forehead?.bpm),
      fmt(r.forehead?.snrDb),
      fmt(r.all?.bpm),
      fmt(r.all?.snrDb),
      fmt(r.me?.bpm),
      fmt(r.me?.snrDb),
      r.fps.toFixed(0),
    ].join(','),
  )
  return [head, ...lines].join('\n')
}

/**
 * MediaPipe(TFLite) WASM은 "INFO: Created TensorFlow Lite XNNPACK delegate" 같은 정보성 로그를
 * console.error로 찍어 Next 개발 오버레이에 '이슈'로 뜬다 → 'INFO:'로 시작하는 것만 걸러낸다.
 * WASM 모듈이 로드 시점의 console.error를 붙잡으므로 BlazeFace 로드 전에 한 번 설치.
 */
let mediapipeInfoFiltered = false
function filterMediapipeInfoLogs() {
  if (mediapipeInfoFiltered) return
  mediapipeInfoFiltered = true
  const original = console.error
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('INFO:')) return
    original(...args)
  }
}

/** BlazeFace(MediaPipe) — 메인 스레드 전용. WASM 인스턴스를 측정마다 새로 만들면 close() 후에도
 *  메모리가 반납되지 않아(시작/정지 1회당 약 20MB 증가) 페이지에서 한 번만 만들어 재사용한다. */
let blazePromise: Promise<FaceDetector> | null = null
function getBlazeFace(): Promise<FaceDetector> {
  blazePromise ??= createBlazeFace().catch((err: unknown) => {
    blazePromise = null
    throw err
  })
  return blazePromise
}

async function createBlazeFace(): Promise<FaceDetector> {
  filterMediapipeInfoLogs()
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks('/vendor/mediapipe')
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/blazeface/blaze_face_short_range.tflite', delegate: 'CPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  })
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

  const liveRef = useRef<Live>(EMPTY_LIVE)
  const detectMsRef = useRef(detectMs)
  const startRef = useRef(0)

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
      if (saved) setRows(JSON.parse(saved) as LabRow[])
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
    let lastPushWall = 0
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
    let meLastPushWall = 0
    const meBuffer: { t: number; v: number }[] = []
    const meLatencies: number[] = []

    if (meEnabled) {
      worker = new Worker(new URL('../lib/meRppg.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<MeWorkerOut>) => {
        const m = e.data
        if (m.type === 'ready') {
          meReady = true
          if (blaze) setMeStatus('ready')
        } else if (m.type === 'error') {
          setMeStatus('error')
          setError(m.message)
        } else {
          meInFlight--
          meOutputs++
          meLatencies.push(m.latency)
          if (meLatencies.length > 60) meLatencies.shift()
          if (meOutputs <= ME_WARMUP) return
          meBuffer.push({ t: m.t, v: m.value })
          while (meBuffer.length > 0 && meBuffer[0].t < m.t - BUFFER_MS) meBuffer.shift()
          meLastPushWall = performance.now()
        }
      }
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
        if (!worker || !blaze || !meReady || meInFlight >= ME_MAX_IN_FLIGHT) return
        const det = blaze.detectForVideo(video, now).detections[0]?.boundingBox
        if (!det) {
          meBox = null
          return
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
        const c = clampCrop(box, w, h)
        if (!c) return
        cropCtx.drawImage(canvas, c.sx, c.sy, c.sw, c.sh, 0, 0, 36, 36)
        const input = rgbaToModelInput(cropCtx.getImageData(0, 0, 36, 36).data)
        // 얼굴을 2초 넘게 놓쳤다 돌아오면 파형 버퍼를 비움 (끊긴 구간을 이어 붙여 보간하지 않게)
        if (meLastSendT !== null && t - meLastSendT > STALE_MS) meBuffer.length = 0
        meLastSendT = t
        meInFlight++
        const msg: MeWorkerIn = { type: 'frame', input, t }
        worker.postMessage(msg, [input.buffer])
      }

      // 매 프레임: 원본을 한 번 그려서 POS ROI 샘플링 + ME-rPPG 입력에 같이 씀
      let lastT = -1
      const onFrame = (now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
        if (stopped) return
        const t = meta.captureTime ?? now
        if (t !== lastT) {
          lastT = t
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
              lastPushWall = now
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
        const fresh = nowWall - lastPushWall < STALE_MS
        const meFresh = nowWall - meLastPushWall < STALE_MS
        while (frameWalls.length > 0 && frameWalls[0] < nowWall - 2000) frameWalls.shift()
        const next: Live = {
          forehead: fresh ? estimateHeartRate(windowed(buffers.forehead)) : null,
          all: fresh ? estimateHeartRate(windowed(buffers.all)) : null,
          me: meFresh ? heartRateFromBvp(meBuffer) : null,
          meLatency: meLatencies.length ? meLatencies.reduce((s, v) => s + v, 0) / meLatencies.length : 0,
          fps: frameWalls.length / 2,
          skin,
          face,
        }
        liveRef.current = next
        setLive(next)
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
      stream?.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height)
      worker?.terminate()
      liveRef.current = EMPTY_LIVE
      setLive(EMPTY_LIVE)
      setMeStatus('loading')
    }
  }, [running, meEnabled])

  // 이벤트 timeStamp는 performance.now()와 같은 기준 시각
  const handleCondition = (c: Condition, at: number) => {
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
        t: (performance.now() - startRef.current) / 1000,
        condition,
        watch: v,
        forehead: l.forehead,
        all: l.all,
        me: l.me,
        fps: l.fps,
      },
    ])
    setWatchInput('')
  }

  const downloadCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `rppg-lab-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const summary = summarizePairs(rows, gateDb)
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
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">spike · 검증 후 폐기</p>
          <h1 className="text-2xl font-bold text-ink-900">rPPG 실험실</h1>
          <p className="mt-1 text-sm text-ink-500">
            워치(또는 휴대폰 손가락 심박 앱)를 기준으로, 옆 사람이 15초마다 BPM을 입력하세요. 조건별로 2분씩.
          </p>
        </header>

        {error && <p className="rounded-lg bg-risk-warning/10 p-3 text-sm text-risk-warning">{error}</p>}

        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-ink-900">
          <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        </div>
        <p className="-mt-3 text-xs text-ink-400">
          초록·노랑 사각형 = POS 이마·볼 영역 / 회색 점선 = ME-rPPG 얼굴 박스
        </p>

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
            <input type="checkbox" checked={meEnabled} onChange={(e) => setMeEnabled(e.target.checked)} />
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
          <Stat label="처리 fps" value={fmt(live.fps, 0)} sub="목표 ≈ 30" />
          <Stat
            label="얼굴 / 이마 피부"
            value={live.face ? '감지' : '없음'}
            sub={`피부 비율 ${Math.round(live.skin * 100)}%`}
          />
          <Stat label="BPM 단위" value="분당" sub="10초 창 · 1초마다 갱신" />
        </div>

        <div className="space-y-3 rounded-xl border border-ink-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.key}
                type="button"
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
            <label className="ml-auto flex items-center gap-2 text-sm text-ink-600">
              품질 게이트 SNR ≥
              <input
                type="number"
                step={0.5}
                value={gateDb}
                onChange={(e) => setGateDb(Number(e.target.value))}
                className="w-16 rounded border border-ink-300 px-2 py-1"
              />
              dB
            </label>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-ink-500">
                <th className="py-2">조건</th>
                <th>추정기</th>
                <th>n</th>
                <th>평균오차</th>
                <th>게이트 통과율</th>
                <th>통과 구간 오차</th>
                <th>목표</th>
              </tr>
            </thead>
            <tbody>
              {CONDITIONS.flatMap((c) =>
                (['forehead', 'all', 'me'] as const).map((roi) => {
                  const s = summary[c.key][roi]
                  return (
                    <tr key={`${c.key}-${roi}`} className="border-b border-ink-100">
                      <td className="py-2">{c.label}</td>
                      <td>{ROI_LABELS[roi]}</td>
                      <td>{s.n}</td>
                      <td>{fmt(s.mae)}</td>
                      <td>{s.n > 0 ? `${Math.round(s.coverage * 100)}%` : '—'}</td>
                      <td>{fmt(s.gatedMae)}</td>
                      <td>{c.target === null ? '참고' : `≤ ${c.target}`}</td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              disabled={rows.length === 0}
              className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              CSV 저장 ({rows.length}행)
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
