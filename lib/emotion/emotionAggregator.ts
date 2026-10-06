import type { EmotionResult } from './emotionAnalysis'
import { getDominantEmotion } from './emotionAnalysis'
import type { EmotionRecordInput } from './emotionRepository'

export interface EmotionSample {
  emotion: EmotionResult | null
  intervalMs: number
}

export function aggregate(
  samples: EmotionSample[],
  endTime: Date,
): EmotionRecordInput | null {
  const detectedSamples = samples.filter(
    (s): s is EmotionSample & { emotion: EmotionResult } => s.emotion !== null,
  )

  if (detectedSamples.length === 0) return null

  const sum: EmotionResult = { happy: 0, calm: 0, sad: 0, angry: 0 }
  for (const s of detectedSamples) {
    sum.happy += s.emotion.happy
    sum.calm += s.emotion.calm
    sum.sad += s.emotion.sad
    sum.angry += s.emotion.angry
  }
  const avg: EmotionResult = {
    happy: sum.happy / detectedSamples.length,
    calm: sum.calm / detectedSamples.length,
    sad: sum.sad / detectedSamples.length,
    angry: sum.angry / detectedSamples.length,
  }

  const dominantEmotion = getDominantEmotion(avg)

  const duration = detectedSamples.reduce((acc, s) => acc + s.intervalMs, 0)
  const totalIntervalMs = samples.reduce((acc, s) => acc + s.intervalMs, 0)
  const detectionRate = totalIntervalMs > 0 ? duration / totalIntervalMs : 0

  let changes = 0
  for (let i = 1; i < detectedSamples.length; i++) {
    const prev = getDominantEmotion(detectedSamples[i - 1].emotion)
    const curr = getDominantEmotion(detectedSamples[i].emotion)
    if (prev !== curr) changes += 1
  }
  const flatAffectScore =
    detectedSamples.length > 1 ? 1 - changes / (detectedSamples.length - 1) : 1

  return {
    timestamp: endTime,
    duration,
    detectionRate,
    happy: avg.happy,
    calm: avg.calm,
    sad: avg.sad,
    angry: avg.angry,
    dominantEmotion,
    flatAffectScore,
  }
}
