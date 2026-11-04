import { describe, expect, it } from 'vitest'
import { demoState, recentMedian, summarizeDemo, DEMO_MOTION_LIMIT } from '@/features/rppg/lib/demoCompare'
import type { TrackedHeartRate } from '@/features/rppg/lib/hrEstimator'

const est = (over: Partial<TrackedHeartRate> = {}): TrackedHeartRate => ({ bpm: 80, snrDb: 3, motion: 0.003, models: 2, ...over })

describe('demoState', () => {
  it('움직임이 기준을 넘으면 숫자를 숨긴다', () => {
    expect(demoState(est({ motion: DEMO_MOTION_LIMIT + 0.01 }))).toBe('motion')
  })
  it('SNR 이 낮으면 약한 신호', () => {
    expect(demoState(est({ snrDb: -2 }))).toBe('weak')
  })
  it('상자 기록이 없으면 움직임은 판단하지 않는다', () => {
    expect(demoState(est({ motion: null }))).toBe('ok')
  })
  it('추정이 없으면 기다린다', () => {
    expect(demoState(null)).toBe('waiting')
  })
})

describe('recentMedian', () => {
  it('최근 5초 값의 중앙값', () => {
    const pts = [
      { t: 1000, bpm: 200 },
      { t: 7000, bpm: 80 },
      { t: 8000, bpm: 82 },
      { t: 9000, bpm: 120 },
    ]
    expect(recentMedian(pts, 10_000)).toBe(82)
    expect(recentMedian([], 10_000)).toBeNull()
  })
})

describe('summarizeDemo', () => {
  it('짝지은 칸만 차이를 내고, 숨긴 칸은 표시율에서 뺀다', () => {
    const r = summarizeDemo([
      { t: 1, watch: 80, rppg: 82 },
      { t: 2, watch: 80, rppg: 90 },
      { t: 3, watch: 81, rppg: null },
      { t: 4, watch: null, rppg: 79 },
    ])
    expect(r.seconds).toBe(4)
    expect(r.paired).toBe(2)
    expect(r.meanAbsDiff).toBe(6)
    expect(r.matchRate).toBe(0.5)
    expect(r.coverage).toBe(0.75)
  })
  it('짝이 없으면 차이는 null', () => {
    expect(summarizeDemo([{ t: 1, watch: 80, rppg: null }]).meanAbsDiff).toBeNull()
  })
})
