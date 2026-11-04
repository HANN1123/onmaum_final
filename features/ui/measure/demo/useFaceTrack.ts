import { useEffect, useState, type RefObject } from 'react'
import * as faceapi from 'face-api.js'
import {
  EMOTION_LABELS,
  getDominantEmotion,
  normalizeExpressions,
  type Emotion,
  type EmotionResult,
} from '@/features/algorithm/emotion/emotionAnalysis'
import { smoothEmotion } from '@/features/algorithm/emotion/emotionSmoothing'
import { loadFaceApiModels } from '@/features/camera/lib/faceDetection'
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

/**
 * 시연용 얼굴 추적. 기존 face-api 모델(/models)과 같은 검출·정렬·정규화로 얼굴 상자와 현재 감정을 얻는다.
 * rPPG 를 붙일 때 원래 앱의 표정 인식과 한 번의 얼굴 검출로 합친다.
 * 저장하지 않고 화면에만 쓴다. mirrored 가 true 면 상자 x 를 좌우 반전한다.
 * 다듬기(2026-11-04): 상자는 EMA 로 부드럽게 잇고, 감정 비율도 EMA(α 0.4)로 다듬은 뒤 우세 감정을 고른다.
 * 검출을 3번 연속 놓쳐야(약 0.75초) 얼굴 없음으로 바꾼다. 다시 찾으면 다듬기를 처음부터 시작한다.
 */
export function useFaceTrack(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  { intervalMs = 250, mirrored = true, rotation = 0 as CameraRotation } = {},
): FaceTrack {
  const [modelsReady, setModelsReady] = useState(false)
  const [box, setBox] = useState<FaceBox | null>(null)
  const [emotion, setEmotion] = useState<Emotion | null>(null)
  const [emotions, setEmotions] = useState<EmotionResult | null>(null)

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
        // 회전 중이면 돌린(비반전) 프레임에서 검출한다. 프레임은 메모리에서만 쓰고 저장하지 않는다
        if (rotated && !drawRotatedFrame(video, rotation, rotated)) return
        const input = rotated ?? video
        const result = await faceapi.detectSingleFace(input, DETECTOR_OPTIONS).withFaceLandmarks().withFaceExpressions()
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
        const { x, y, width, height } = result.detection.box
        const iw = (rotated ? rotated.width : video.videoWidth) || 1
        const ih = (rotated ? rotated.height : video.videoHeight) || 1
        const raw = { x: x / iw, y: y / ih, w: width / iw, h: height / ih }
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
