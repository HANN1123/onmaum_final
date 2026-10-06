import type { EmotionRecord } from '../storage/db'
import { aggregateStress, type StressScores } from './stressIndex'

export const RECENT_WINDOW_MS = 30 * 60 * 1000
export const PERIOD_BUCKET_HOURS = 2

function localDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD (로컬)
}

export function dailyStressFor(records: EmotionRecord[], date: string): StressScores | null {
  return aggregateStress(records.filter((r) => localDateKey(r.timestamp) === date))
}

export interface DailyStressPoint {
  date: string
  scores: StressScores | null
  totalDuration: number
}

export function dailyStressHistory(
  records: EmotionRecord[],
  days: number,
  today: Date,
): DailyStressPoint[] {
  const out: DailyStressPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = localDateKey(d)
    const dayRecords = records.filter((r) => localDateKey(r.timestamp) === date)
    out.push({
      date,
      scores: aggregateStress(dayRecords),
      totalDuration: dayRecords.reduce((s, r) => s + r.duration, 0),
    })
  }
  return out
}

export function recentStress(
  records: EmotionRecord[],
  now: Date,
  windowMs: number = RECENT_WINDOW_MS,
): StressScores | null {
  const cutoff = now.getTime() - windowMs
  return aggregateStress(records.filter((r) => r.timestamp.getTime() >= cutoff))
}

export function hardestPeriod(
  records: EmotionRecord[],
): { startHour: number; stress: number } | null {
  const byBucket = new Map<number, EmotionRecord[]>()
  for (const r of records) {
    const startHour = Math.floor(r.timestamp.getHours() / PERIOD_BUCKET_HOURS) * PERIOD_BUCKET_HOURS
    const arr = byBucket.get(startHour) ?? []
    arr.push(r)
    byBucket.set(startHour, arr)
  }
  let best: { startHour: number; stress: number } | null = null
  for (const [startHour, arr] of byBucket) {
    const s = aggregateStress(arr)
    if (s && (best === null || s.stress > best.stress)) best = { startHour, stress: s.stress }
  }
  return best
}
