import { useEffect, useState, type RefObject } from 'react'
import * as faceapi from 'face-api.js'
import {
  EMOTION_LABELS,
  getDominantEmotion,
  normalizeExpressions,
  type Emotion,
} from '@/features/algorithm/emotion/emotionAnalysis'
import { loadFaceApiModels } from '@/features/camera/lib/faceDetection'

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
  emotionLabel: string | null
}

const DETECTOR_OPTIONS = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })

/**
 * 시연용 얼굴 추적. 기존 face-api 모델(/models)로 얼굴 상자와 현재 감정을 얻는다.
 * 저장하지 않고 화면에만 쓴다. mirrored 가 true 면 상자 x 를 좌우 반전한다.
 */
export function useFaceTrack(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  { intervalMs = 250, mirrored = true } = {},
): FaceTrack {
  const [modelsReady, setModelsReady] = useState(false)
  const [box, setBox] = useState<FaceBox | null>(null)
  const [emotion, setEmotion] = useState<Emotion | null>(null)

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

    const timer = setInterval(async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || busy) return
      busy = true
      try {
        const result = await faceapi.detectSingleFace(video, DETECTOR_OPTIONS).withFaceExpressions()
        if (cancelled) return
        if (!result) {
          setBox(null)
          setEmotion(null)
          return
        }
        const { x, y, width, height } = result.detection.box
        const vw = video.videoWidth || 1
        const vh = video.videoHeight || 1
        const rx = x / vw
        setBox({ x: mirrored ? 1 - rx - width / vw : rx, y: y / vh, w: width / vw, h: height / vh })
        setEmotion(getDominantEmotion(normalizeExpressions(result.expressions)))
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
  }, [enabled, modelsReady, videoRef, intervalMs, mirrored])

  return { modelsReady, box, emotion, emotionLabel: emotion ? EMOTION_LABELS[emotion] : null }
}
