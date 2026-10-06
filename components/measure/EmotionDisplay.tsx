'use client'

import {
  EMOTION_LABELS,
  EMOTION_ORDER,
  getDominantEmotion,
  type Emotion,
  type EmotionResult,
} from '@/lib/emotion/emotionAnalysis'

const TEXT_COLOR: Record<Emotion, string> = {
  happy: 'text-risk-good',
  calm: 'text-ink-700',
  sad: 'text-risk-caution',
  angry: 'text-risk-warning',
}

const BAR_COLOR: Record<Emotion, string> = {
  happy: 'bg-risk-good',
  calm: 'bg-ink-500',
  sad: 'bg-risk-caution',
  angry: 'bg-risk-warning',
}

interface Props {
  emotion: EmotionResult | null
}

export default function EmotionDisplay({ emotion }: Props) {
  if (!emotion) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center text-sm text-ink-500">
        얼굴이 감지되지 않습니다
      </div>
    )
  }

  const dominant = getDominantEmotion(emotion)
  const dominantPercent = Math.round(emotion[dominant] * 100)

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6">
      <div className="text-center">
        <p className="text-sm text-ink-500">현재 감정</p>
        <p className={`mt-2 text-4xl font-bold ${TEXT_COLOR[dominant]}`}>
          {EMOTION_LABELS[dominant]}
        </p>
        <p className="mt-1 text-sm text-ink-500 tabular-nums">
          {dominantPercent}%
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {EMOTION_ORDER.map((key) => {
          const percent = Math.round(emotion[key] * 100)
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs text-ink-600">
                <span>{EMOTION_LABELS[key]}</span>
                <span className="tabular-nums">{percent}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full transition-[width] duration-300 ${BAR_COLOR[key]}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
