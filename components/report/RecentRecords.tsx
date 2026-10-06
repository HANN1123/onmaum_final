'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/storage/db'
import { EMOTION_LABELS, type Emotion } from '@/lib/emotion/emotionAnalysis'

const DOT_COLOR: Record<Emotion, string> = {
  happy: 'bg-risk-good',
  calm: 'bg-ink-500',
  sad: 'bg-risk-caution',
  angry: 'bg-risk-warning',
}

const RECENT_LIMIT = 5

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDuration(ms: number): string {
  return `${Math.round(ms / 1000)}초`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export default function RecentRecords() {
  const records = useLiveQuery(
    () =>
      db.emotions.orderBy('timestamp').reverse().limit(RECENT_LIMIT).toArray(),
    [],
  )
  const totalCount = useLiveQuery(() => db.emotions.count(), [])

  if (records === undefined || totalCount === undefined) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center text-sm text-ink-500">
        ⏳ 기록 불러오는 중...
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center text-sm text-ink-500">
        아직 저장된 기록이 없습니다 — 측정을 시작해 보세요
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between text-xs text-ink-500">
        <span className="font-medium">최근 기록</span>
        <span>총 {totalCount}개</span>
      </div>
      <ul className="space-y-2">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${DOT_COLOR[r.dominantEmotion]}`}
              />
              <span className="tabular-nums text-ink-900">
                {formatTime(r.timestamp)}
              </span>
              <span className="font-medium">
                {EMOTION_LABELS[r.dominantEmotion]}{' '}
                {formatPercent(r[r.dominantEmotion])}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-ink-500">
              <span>{formatDuration(r.duration)}</span>
              <span>평탄 {r.flatAffectScore.toFixed(2)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
