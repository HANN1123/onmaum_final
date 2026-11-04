'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { FaceDetector } from '@mediapipe/tasks-vision'
import { createFrameClock, MAX_SAMPLE_GAP_MS } from '../lib/rppg'
import { createHrTracker, type BoxSample } from '../lib/hrEstimator'
import { clampCrop, createKalman1D, expandFaceBox, rgbaToModelInput, type Kalman1D } from '../lib/meRppg'
import type { MeWorkerIn, MeWorkerOut } from '../lib/meRppg.worker'
import type { CameraRotation } from '@/shared/storage/cameraRotation'
import { getBlazeFace } from './blazeFace'
import { DEFAULT_MIN_SNR_DB, gateReading, OFF_READING, pulseLevel, type RppgReading } from './rppgGate'

/** 워커에 쌓인 프레임이 이만큼이면 새 프레임은 건너뛴다(실험실과 같음) */
const ME_MAX_IN_FLIGHT = 5
/** 파형 버퍼 길이. 추정은 최근 10초를 쓴다 */
const BUFFER_MS = 12_000
/** 추정·게이트 판정 주기 */
const ESTIMATE_MS = 1_000

interface Options {
  /** SNR 기준(dB). 기본은 잠정값 0dB */
  minSnrDb?: number
  /** 카메라 회전(시계 방향). 돌린 프레임을 BlazeFace·crop 입력으로 쓴다(측정 화면과 같은 규칙) */
  rotation?: CameraRotation
}

/**
 * 측정 화면용 ME-rPPG 엔진. 실험실(RppgLab)의 ME-rPPG 경로를 그대로 옮겼다.
 *   BlazeFace(매 프레임) 얼굴 박스 → 칼만 → 높이 1.2배·위로 20% → 36×36 → 워커에서 ONNX 추론 → 맥박 파형 → BPM
 * BPM 은 hrEstimator(대역 통과·얼굴 흔들림 주파수 제거·직전 값 추적)로 낸다(2026-11-04, MCD-rPPG 60개 영상에서
 * 평균 오차 2.73 → 2.26 BPM). 흔들림이 크면 게이트가 '움직임 감지'로 숫자를 숨긴다.
 * 같은 video 요소에서 감정 분석(face-api)이 따로 돌아도 된다. 영상·프레임·파형은 저장하거나 밖으로 보내지 않는다.
 * enabled 가 false 이면 아무것도 하지 않고 OFF 를 돌려준다.
 * getPulse 는 게이트를 통과한 동안에만 실제 파형을 0~1 로 돌려주고, 그 밖에는 0(평평한 선)이다.
 */
export function useMeRppg(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  { minSnrDb = DEFAULT_MIN_SNR_DB, rotation = 0 }: Options = {},
): { reading: RppgReading; getPulse: () => number } {
  const [reading, setReading] = useState<RppgReading>(OFF_READING)
  const bufferRef = useRef<{ t: number; v: number }[]>([])
  const liveRef = useRef(false)
  // 회전은 엔진(worker·모델)을 다시 만들지 않고 프레임 처리에서 바꾼다. 바뀐 순간 상태를 모두 버린다
  const rotationRef = useRef<CameraRotation>(rotation)
  useEffect(() => {
    rotationRef.current = rotation
  }, [rotation])

  useEffect(() => {
    if (!enabled) return
    const video = videoRef.current
    if (!video) return

    let stopped = false
    let frameHandle: number | null = null
    let worker: Worker | null = null
    let blaze: FaceDetector | null = null
    let workerReady = false
    let engineError = false
    let inFlight = 0
    let outputs = 0
    let epoch = 0
    let kalman: Kalman1D[] | null = null
    let lastSendT: number | null = null
    let face = false
    let firstEstimateAt: number | null = null
    const clock = createFrameClock()
    const buffer: { t: number; v: number }[] = []
    bufferRef.current = buffer
    /** 추정 창의 얼굴 흔들림을 재려고 칼만 상자 중심·너비를 남긴다(좌표만, 영상은 남기지 않는다) */
    const boxes: BoxSample[] = []
    const tracker = createHrTracker()
    liveRef.current = false

    let appliedRotation = rotationRef.current
    const rotatedCanvas = document.createElement('canvas')
    const rotatedCtx = rotatedCanvas.getContext('2d')
    /** 돌린(비반전) 프레임을 그린다. 크기는 해상도·방향이 바뀔 때만 다시 정한다 */
    const drawRotated = (r: CameraRotation): boolean => {
      if (!rotatedCtx) return false
      const w = video.videoWidth
      const h = video.videoHeight
      const sideways = r === 90 || r === 270
      const cw = sideways ? h : w
      const ch = sideways ? w : h
      if (rotatedCanvas.width !== cw || rotatedCanvas.height !== ch) {
        rotatedCanvas.width = cw
        rotatedCanvas.height = ch
      }
      rotatedCtx.setTransform(1, 0, 0, 1, 0, 0)
      rotatedCtx.translate(cw / 2, ch / 2)
      rotatedCtx.rotate((r * Math.PI) / 180)
      rotatedCtx.drawImage(video, -w / 2, -h / 2, w, h)
      return true
    }

    const crop = document.createElement('canvas')
    crop.width = 36
    crop.height = 36
    const cropCtx = crop.getContext('2d', { willReadFrequently: true })

    const fail = (message: string) => {
      console.error(message)
      engineError = true
      worker?.terminate()
      worker = null
      workerReady = false
    }

    /** 끊긴 뒤에는 모델 상태·칼만·파형을 모두 버리고 새로 시작한다. 이전 프레임의 늦은 응답은 epoch 로 거른다 */
    const reset = () => {
      epoch++
      inFlight = 0
      outputs = 0
      kalman = null
      firstEstimateAt = null
      buffer.length = 0
      boxes.length = 0
      tracker.reset()
      const msg: MeWorkerIn = { type: 'reset' }
      worker?.postMessage(msg)
    }

    worker = new Worker(new URL('../lib/meRppg.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<MeWorkerOut>) => {
      const m = e.data
      if (m.type === 'ready') workerReady = true
      else if (m.type === 'error') fail(`ME-rPPG: ${m.message}`)
      else {
        if (m.epoch !== epoch) return
        inFlight--
        outputs++
        buffer.push({ t: m.t, v: m.value })
        while (buffer.length > 0 && buffer[0].t < m.t - BUFFER_MS) buffer.shift()
      }
    }
    worker.onerror = (e) => fail(`ME-rPPG worker 오류: ${e.message}`)
    getBlazeFace()
      .then((d) => {
        if (!stopped) blaze = d
      })
      .catch((err: unknown) => fail(`BlazeFace 로드 실패: ${err instanceof Error ? err.message : String(err)}`))

    const sendFrame = (now: number, t: number) => {
      if (!worker || !blaze || !workerReady || !cropCtx) return
      if (video.readyState < 2 || video.videoWidth === 0) return
      // 방향이 바뀌면 이전 방향의 모델 상태·칼만·파형·표시값을 즉시 버린다. 늦은 이전 응답은 epoch 로 걸러진다
      const r = rotationRef.current
      if (r !== appliedRotation) {
        appliedRotation = r
        reset()
        face = false
        lastSendT = null
        liveRef.current = false
        setReading({ status: 'warming', bpm: null, snrDb: null, ageMs: null })
      }
      if (inFlight >= ME_MAX_IN_FLIGHT) return
      // 0°는 영상을 그대로 쓴다(추가 비용 없음). BlazeFace 시간축은 원본 영상의 프레임 시각(now)을 그대로 쓴다
      if (r !== 0 && !drawRotated(r)) return
      const source = r === 0 ? video : rotatedCanvas
      const sw = r === 0 ? video.videoWidth : rotatedCanvas.width
      const sh = r === 0 ? video.videoHeight : rotatedCanvas.height
      const det = blaze.detectForVideo(source, now).detections[0]?.boundingBox
      if (!det) {
        face = false
        return
      }
      face = true
      // 끊겼다 돌아오면 파형만 비우지 않고 모델 상태까지 새로 시작한다. 기준은 신호처리의 공백과 같다
      if (lastSendT !== null && t - lastSendT > MAX_SAMPLE_GAP_MS) reset()
      if (!kalman) {
        kalman = [det.originX, det.originY, det.width, det.height].map((v) => createKalman1D(1e-2, 5e-1, v, 1))
      }
      const [kx, ky, kw, kh] = kalman
      const box = expandFaceBox({
        originX: kx.update(det.originX),
        originY: ky.update(det.originY),
        width: kw.update(det.width),
        height: kh.update(det.height),
      })
      boxes.push({ t, cx: box.originX + box.width / 2, cy: box.originY + box.height / 2, w: box.width })
      while (boxes.length > 0 && boxes[0].t < t - BUFFER_MS) boxes.shift()
      const c = clampCrop(box, sw, sh)
      if (!c) return
      // 전체 프레임을 다시 그리지 않고 영상에서 얼굴 부분만 바로 36×36 으로 줄인다
      cropCtx.drawImage(source, c.sx, c.sy, c.sw, c.sh, 0, 0, 36, 36)
      const input = rgbaToModelInput(cropCtx.getImageData(0, 0, 36, 36).data)
      lastSendT = t
      inFlight++
      const msg: MeWorkerIn = { type: 'frame', input, t, epoch }
      worker.postMessage(msg, [input.buffer])
    }

    const onFrame = (now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
      if (stopped) return
      const t = clock.next(now, meta.captureTime)
      if (t !== null) {
        try {
          sendFrame(now, t)
        } catch (err) {
          console.error('rPPG 프레임 처리 실패:', err)
        }
      }
      frameHandle = video.requestVideoFrameCallback(onFrame)
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
      frameHandle = video.requestVideoFrameCallback(onFrame)
    } else {
      fail('이 브라우저는 영상 프레임 콜백(requestVideoFrameCallback)을 지원하지 않습니다')
    }

    const estimateTimer = setInterval(() => {
      const last = buffer[buffer.length - 1]
      // 신선도는 응답 도착이 아니라 원본 프레임 시각으로 판단한다. 프레임 시각과 같은 시계(performance.now)를 쓴다
      const nowMs = performance.now()
      const estimate = last ? tracker.estimate([buffer], boxes) : null
      if (estimate && firstEstimateAt === null) firstEstimateAt = nowMs
      const next = gateReading({
        engine: engineError ? 'error' : workerReady && blaze ? 'ready' : 'loading',
        face,
        outputs,
        lastFrameT: last ? last.t : null,
        now: nowMs,
        estimate,
        firstEstimateAt,
        minSnrDb,
        motion: estimate?.motion ?? null,
      })
      liveRef.current = next.status === 'live'
      setReading((prev) =>
        prev.status === next.status && prev.bpm === next.bpm && prev.snrDb === next.snrDb ? prev : next,
      )
    }, ESTIMATE_MS)

    return () => {
      stopped = true
      if (frameHandle !== null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(frameHandle)
      }
      clearInterval(estimateTimer)
      worker?.terminate()
      liveRef.current = false
      buffer.length = 0
      setReading(OFF_READING)
    }
  }, [videoRef, enabled, minSnrDb])

  const getPulse = useCallback(() => (liveRef.current ? pulseLevel(bufferRef.current) : 0), [])

  return { reading, getPulse }
}
