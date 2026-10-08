export type Emotion = 'happy' | 'calm' | 'sad' | 'angry'

export interface EmotionResult {
  happy: number
  calm: number
  sad: number
  angry: number
}

export const EMOTION_LABELS: Record<Emotion, string> = {
  happy: '기쁨',
  calm: '평온',
  sad: '슬픔',
  angry: '화남',
}

export const EMOTION_ORDER: Emotion[] = ['happy', 'calm', 'sad', 'angry']

export interface RawExpressions {
  happy: number
  neutral: number
  sad: number
  angry: number
  disgusted: number
}

export function normalizeExpressions(raw: RawExpressions): EmotionResult {
  const happy = raw.happy
  const calm = raw.neutral
  const sad = raw.sad
  const angry = raw.angry + raw.disgusted // disgust를 적대/부정 정서로 합침 (spec §3)
  const sum = happy + calm + sad + angry
  if (sum <= 0) return { happy: 0, calm: 1, sad: 0, angry: 0 }
  return { happy: happy / sum, calm: calm / sum, sad: sad / sum, angry: angry / sum }
}

export function getDominantEmotion(emotions: EmotionResult): Emotion {
  return EMOTION_ORDER.reduce((best, current) =>
    emotions[current] > emotions[best] ? current : best,
  )
}
