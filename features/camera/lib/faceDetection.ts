import * as faceapi from 'face-api.js'

import { normalizeExpressions, type EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'

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

export async function analyzeEmotion(
  videoEl: HTMLVideoElement,
): Promise<EmotionResult | null> {
  const detection = await faceapi
    .detectSingleFace(videoEl, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceExpressions()

  if (!detection) return null

  return normalizeExpressions(detection.expressions)
}
