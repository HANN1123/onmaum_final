'use client'

import { useEffect, useState } from 'react'
import type { EmotionRecord } from '@/shared/storage/db'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { aggregateStress } from '@/features/algorithm/stress/stressIndex'
import { dailyStressHistory, hardestPeriod, PERIOD_BUCKET_HOURS } from '@/features/algorithm/stress/dailyStress'
import { computeBaselineState, classifyStress, BASELINE_WINDOW_DAYS, type StressLevel } from '@/features/algorithm/baseline/baseline'
import { applyOffset } from '@/features/algorithm/baseline/calibration'
import { topTwoEmotions } from '@/features/ui/orb/lib/orbColor'
import { loadProfile, type Profile } from '@/shared/storage/profile'
import { suggestionFor } from '@/features/feedback/lib/selfCareSuggestion'

function averageEmotion(records: EmotionRecord[]): EmotionResult {
  const total = records.reduce((sum, r) => sum + r.duration, 0)
  if (total <= 0) return { happy: 0, calm: 1, sad: 0, angry: 0 }
  const acc = { happy: 0, calm: 0, sad: 0, angry: 0 }
  for (const r of records) {
    acc.happy += r.happy * r.duration
    acc.calm += r.calm * r.duration
    acc.sad += r.sad * r.duration
    acc.angry += r.angry * r.duration
  }
  return { happy: acc.happy / total, calm: acc.calm / total, sad: acc.sad / total, angry: acc.angry / total }
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-600">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
      </div>
    </div>
  )
}

const LEVEL_BADGE: Record<StressLevel, { text: string; cls: string }> = {
  low: { text: '평소보다 가벼움', cls: 'bg-risk-good/10 text-risk-good' },
  typical: { text: '평소와 비슷', cls: 'bg-ink-100 text-ink-600' },
  high: { text: '평소보다 높음', cls: 'bg-risk-caution/10 text-risk-caution' },
  veryHigh: { text: '평소보다 많이 높음', cls: 'bg-risk-warning/10 text-risk-warning' },
}

/** 기록이 3일 미만이라 개인 기준선이 없을 때(절대 판정). "평소" 비교 표현을 쓰지 않는다 */
const ABSOLUTE_BADGE_TEXT: Record<StressLevel, string> = {
  low: '가벼움',
  typical: '보통',
  high: '높음',
  veryHigh: '많이 높음',
}

interface Props {
  records: EmotionRecord[]
  historyRecords: EmotionRecord[]
  offset: number
  now?: Date
}

export default function DailyReport({ records, historyRecords, offset, now = new Date() }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => {
    // localStorage는 클라이언트에서만 — hydration mismatch 방지를 위한 의도적 setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(loadProfile())
  }, [])

  const scores = aggregateStress(records)
  if (!scores) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-5 text-center text-sm text-ink-500">
        아직 오늘 기록이 충분하지 않아요
      </div>
    )
  }

  const adjustedN = applyOffset(scores.stress, offset)
  const baseline = computeBaselineState(dailyStressHistory(historyRecords, BASELINE_WINDOW_DAYS, now))
  const level = classifyStress(adjustedN, baseline)
  const badge =
    baseline.mode === 'relative' ? LEVEL_BADGE[level] : { ...LEVEL_BADGE[level], text: ABSOLUTE_BADGE_TEXT[level] }

  const hard = hardestPeriod(records)
  const [dominant] = topTwoEmotions(averageEmotion(records))
  const suggestion = suggestionFor(dominant, profile)

  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink-900">오늘도 고생했어요</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>{badge.text}</span>
      </div>
      <div className="space-y-3">
        <Gauge label="긍정" value={scores.positive} color="linear-gradient(90deg,#9bd6a0,#f2c94c)" />
        <Gauge label="스트레스" value={adjustedN} color="linear-gradient(90deg,#f0b39f,#e8806a)" />
      </div>
      {hard && (
        <p className="text-xs text-ink-500">
          힘들었던 시간대: {hard.startHour}–{hard.startHour + PERIOD_BUCKET_HOURS}시
        </p>
      )}
      <div className="rounded-xl bg-risk-good/10 p-3 text-sm text-ink-800">{suggestion}</div>
    </div>
  )
}
