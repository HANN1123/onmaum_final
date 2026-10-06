import type { DailyStressPoint } from './dailyStress'

export type StressLevel = 'low' | 'typical' | 'high' | 'veryHigh'
export type BaselineMode = 'absolute' | 'relative'

export interface BaselineState {
  mode: BaselineMode
  baselineN: number | null
}

export const BASELINE_WINDOW_DAYS = 14
export const MIN_VALID_DAY_DURATION_MS = 5 * 60 * 1000
export const MIN_VALID_DAYS = 3
export const ABS_FLOOR_N = 20

export const REL_LOW = 0.8
export const REL_HIGH = 1.25
export const REL_VERY_HIGH = 1.6

export const ABS_LOW = 15
export const ABS_TYPICAL = 30
export const ABS_HIGH = 50

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** history: 오래된→최근(오늘 포함). 마지막(오늘)은 제외하고 기준선 계산. */
export function computeBaselineState(history: DailyStressPoint[]): BaselineState {
  const past = history.slice(0, -1)
  const validN = past
    .filter((p) => p.scores !== null && p.totalDuration >= MIN_VALID_DAY_DURATION_MS)
    .map((p) => p.scores!.stress)
  if (validN.length < MIN_VALID_DAYS) return { mode: 'absolute', baselineN: null }
  return { mode: 'relative', baselineN: median(validN) }
}

export function classifyStress(value: number, baseline: BaselineState): StressLevel {
  if (baseline.mode === 'relative' && baseline.baselineN !== null && baseline.baselineN > 0) {
    const ratio = value / baseline.baselineN
    if (ratio >= REL_VERY_HIGH && value >= ABS_FLOOR_N) return 'veryHigh'
    if (ratio >= REL_HIGH && value >= ABS_FLOOR_N) return 'high'
    if (ratio < REL_LOW) return 'low'
    return 'typical'
  }
  if (value > ABS_HIGH) return 'veryHigh'
  if (value > ABS_TYPICAL) return 'high'
  if (value < ABS_LOW) return 'low'
  return 'typical'
}
