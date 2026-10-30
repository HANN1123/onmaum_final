import * as faceapi from 'face-api.js'

import { normalizeExpressions, type EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { drawRotatedFrame } from '@/features/camera/lib/rotateFrame'
import type { CameraRotation } from '@/shared/storage/cameraRotation'

const MODELS_URL = '/models'

const DETECTOR_OPTIONS = new faceapi.SsdMobilenetv1Options({
  minConfidence: 0.5,
})

export async function loadFaceApiModels(): Promise<void> {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
  ])
}

let rotationCanvas: HTMLCanvasElement | null = null

/** 회전이 없으면 영상을 그대로, 있으면 바로 세운 프레임을 검출기에 넘긴다 */
function analysisInput(
  videoEl: HTMLVideoElement,
  rotation: CameraRotation,
): HTMLVideoElement | HTMLCanvasElement {
  if (rotation === 0) return videoEl
  rotationCanvas ??= document.createElement('canvas')
  return drawRotatedFrame(videoEl, rotation, rotationCanvas) ? rotationCanvas : videoEl
}

export async function analyzeEmotion(
  videoEl: HTMLVideoElement,
  rotation: CameraRotation = 0,
): Promise<EmotionResult | null> {
  const detection = await faceapi
    .detectSingleFace(analysisInput(videoEl, rotation), DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceExpressions()

  if (!detection) return null

  return normalizeExpressions(detection.expressions)
}
