import { useEffect, useRef, useState, type RefObject } from 'react'
import * as faceapi from 'face-api.js'
import {
  EMOTION_LABELS,
  getDominantEmotion,
  normalizeExpressions,
  type Emotion,
  type EmotionResult,
} from '@/features/algorithm/emotion/emotionAnalysis'
import { smoothEmotion } from '@/features/algorithm/emotion/emotionSmoothing'
import { expressionsFromBox } from '@/features/camera/lib/expressionsFromBox'
import { loadFaceApiModels } from '@/features/camera/lib/faceDetection'
import type { EngineFace } from '@/features/rppg/engine/useMeRppg'
import { drawRotatedFrame } from '@/features/camera/lib/rotateFrame'
import type { CameraRotation } from '@/shared/storage/cameraRotation'
import { mirrorBox } from './rotationLayout'
import { nextPresence, NO_PRESENCE, smoothBox } from './trackSmoothing'

export interface FaceBox {
  /** 영상 크기에 대한 비율(0~1). 거울 반전된 영상 기준으로 이미 뒤집어 둔다. */
  x: number
  y: number
  w: number
  h: number
}

export interface FaceTrack {
  modelsReady: boolean
  box: FaceBox | null
  emotion: Emotion | null
  /** EMA 로 다듬은 감정 비율. 얼굴이 없으면 null (데스크톱 위젯에 보낸다) */
  emotions: EmotionResult | null
  emotionLabel: string | null
}

const DETECTOR_OPTIONS = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
/** 엔진 얼굴 상자를 쓸 수 있는 최대 나이. 엔진은 매 프레임 갱신하므로 이보다 오래되면 놓친 것으로 본다 */
const ENGINE_FACE_FRESH_MS = 400
/** BlazeFace 상자는 얼굴에 꼭 맞아서, 랜드마크가 턱·눈썹까지 잡히게 사방으로 조금 넓힌다 */
const ENGINE_BOX_MARGIN = 0.1

/**
 * 시연용 얼굴 추적. 기존 face-api 모델(/models)과 같은 검출·정렬·정규화로 얼굴 상자와 현재 감정을 얻는다.
 * rPPG 를 붙일 때 원래 앱의 표정 인식과 한 번의 얼굴 검출로 합친다.
 * 저장하지 않고 화면에만 쓴다. mirrored 가 true 면 상자 x 를 좌우 반전한다.
 * 다듬기(2026-11-04): 상자는 EMA 로 부드럽게 잇고, 감정 비율도 EMA(α 0.4)로 다듬은 뒤 우세 감정을 고른다.
 * 검출을 3번 연속 놓쳐야(약 0.75초) 얼굴 없음으로 바꾼다. 다시 찾으면 다듬기를 처음부터 시작한다.
 * 얼굴 찾기(2026-11-04): rPPG 엔진이 돌고 있으면(getFace) 엔진이 매 프레임 BlazeFace 로 찾은 상자를 쓰고,
 * face-api 는 랜드마크·정렬·표정만 돌린다(SSD 생략). 엔진이 돌지 않을 때만 예전처럼 SSD 로 찾는다.
 * BlazeFace 가 SSD 보다 얼굴을 잘 잡았고(rPPG 는 측정 중인데 얼굴 행은 "찾는 중"이던 사례), 가장 무거운 SSD 를 빼서 rPPG 연산 여유도 생긴다.
 */
export function useFaceTrack(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  {
    intervalMs = 250,
    mirrored = true,
    rotation = 0 as CameraRotation,
    getFace,
  }: { intervalMs?: number; mirrored?: boolean; rotation?: CameraRotation; getFace?: () => EngineFace } = {},
): FaceTrack {
  const [modelsReady, setModelsReady] = useState(false)
  const [box, setBox] = useState<FaceBox | null>(null)
  const [emotion, setEmotion] = useState<Emotion | null>(null)
  const [emotions, setEmotions] = useState<EmotionResult | null>(null)
  const getFaceRef = useRef(getFace)
  useEffect(() => {
    getFaceRef.current = getFace
  }, [getFace])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadFaceApiModels()
      .then(() => {
        if (!cancelled) setModelsReady(true)
      })
      .catch((err: unknown) => console.error('face-api 모델 로드 실패:', err))
    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !modelsReady) return
    let cancelled = false
    let busy = false
    let presence = NO_PRESENCE
    let lastBox: FaceBox | null = null
    let ema: EmotionResult | null = null
    // 회전이 바뀌면 이 효과가 다시 시작된다. 이전 방향의 상자·감정은 즉시 지우고 다듬기를 처음부터 한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBox(null)
    setEmotion(null)
    setEmotions(null)
    const rotated = rotation === 0 ? null : document.createElement('canvas')

    const timer = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || busy) return
      busy = true
      try {
        // 원래 앱(faceDetection.analyzeEmotion)과 같이 랜드마크로 얼굴을 반듯하게 정렬한 뒤 표정을 읽는다.
        // 랜드마크를 건너뛰면 검출 상자를 그대로 잘라 읽어, 고개를 돌렸을 때 감정이 원래 앱과 달라질 수 있다.
        const engine: EngineFace = getFaceRef.current?.() ?? { status: 'inactive' }
        let result: { x: number; y: number; w: number; h: number; iw: number; ih: number; expressions: faceapi.FaceExpressions } | null = null
        if (engine.status !== 'inactive') {
          // 엔진이 돌고 있으면 그 상자만 쓴다(SSD 를 돌리지 않는다). 방향이 다르거나 오래된 상자는 쓰지 않는다
          const fresh = engine.status === 'face' && performance.now() - engine.at < ENGINE_FACE_FRESH_MS && engine.rotation === rotation
          if (fresh) {
            if (rotated && !drawRotatedFrame(video, rotation, rotated)) return
            const input = rotated ?? video
            const mx = engine.w * ENGINE_BOX_MARGIN
            const my = engine.h * ENGINE_BOX_MARGIN
            const boxPx = { x: engine.x - mx, y: engine.y - my, w: engine.w + 2 * mx, h: engine.h + 2 * my }
            const expressions = await expressionsFromBox(input, boxPx, engine.sw, engine.sh, engine.score)
            if (expressions) result = { x: engine.x, y: engine.y, w: engine.w, h: engine.h, iw: engine.sw, ih: engine.sh, expressions }
          }
        } else {
          // 회전 중이면 돌린(비반전) 프레임에서 검출한다. 프레임은 메모리에서만 쓰고 저장하지 않는다
          if (rotated && !drawRotatedFrame(video, rotation, rotated)) return
          const input = rotated ?? video
          const ssd = await faceapi.detectSingleFace(input, DETECTOR_OPTIONS).withFaceLandmarks().withFaceExpressions()
          if (ssd) {
            const { x, y, width, height } = ssd.detection.box
            const iw = (rotated ? rotated.width : video.videoWidth) || 1
            const ih = (rotated ? rotated.height : video.videoHeight) || 1
            result = { x, y, w: width, h: height, iw, ih, expressions: ssd.expressions }
          }
        }
        if (cancelled) return
        presence = nextPresence(presence, Boolean(result))
        if (!result) {
          // 잠깐 놓친 동안은 마지막 상자·감정을 유지하고, 연속으로 놓쳤을 때만 지운다
          if (!presence.present) {
            lastBox = null
            ema = null
            setBox(null)
            setEmotion(null)
            setEmotions(null)
          }
          return
        }
        const raw = { x: result.x / result.iw, y: result.y / result.ih, w: result.w / result.iw, h: result.h / result.ih }
        lastBox = smoothBox(lastBox, mirrored ? mirrorBox(raw) : raw)
        ema = smoothEmotion(ema, normalizeExpressions(result.expressions))
        setBox(lastBox)
        setEmotion(getDominantEmotion(ema))
        setEmotions(ema)
      } catch (err) {
        console.error('얼굴 검출 실패:', err)
      } finally {
        busy = false
      }
    }, intervalMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, modelsReady, videoRef, intervalMs, mirrored, rotation])

  return { modelsReady, box, emotion, emotions, emotionLabel: emotion ? EMOTION_LABELS[emotion] : null }
}
