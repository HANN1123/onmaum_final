import { describe, it, expect } from 'vitest'
import {
  dailyStressFor,
  dailyStressHistory,
  recentStress,
  hardestPeriod,
  RECENT_WINDOW_MS,
  MIN_PERIOD_DURATION_MS,
} from '@/features/algorithm/stress/dailyStress'
import type { EmotionRecord } from '@/shared/storage/db'

function rec(partial: Partial<EmotionRecord> & { timestamp: Date; duration: number }): EmotionRecord {
  return {
    id: 0,
    detectionRate: 1,
    happy: 0,
    calm: 0,
    sad: 0,
    angry: 0,
    dominantEmotion: 'calm',
    flatAffectScore: 0,
    ...partial,
  }
}

describe('dailyStressFor', () => {
  it('해당 날짜 레코드만 집계, 없으면 null', () => {
    const records = [
      rec({ timestamp: new Date('2026-06-10T11:00:00'), duration: 1000, angry: 0.4 }),
      rec({ timestamp: new Date('2026-06-11T11:00:00'), duration: 1000, happy: 1 }),
    ]
    const s = dailyStressFor(records, '2026-06-10')!
    expect(s.stress).toBeCloseTo(60) // 0.4×1.5×100
    expect(dailyStressFor(records, '2026-06-12')).toBeNull()
  })
})

describe('dailyStressHistory', () => {
  it('오래된→최근 순, days 길이 고정, 빈 날 scores=null', () => {
    const today = new Date('2026-06-12T09:00:00')
    const records = [rec({ timestamp: new Date('2026-06-11T11:00:00'), duration: 60000, happy: 1 })]
    const hist = dailyStressHistory(records, 3, today)
    expect(hist.map((h) => h.date)).toEqual(['2026-06-10', '2026-06-11', '2026-06-12'])
    expect(hist[0].scores).toBeNull()
    expect(hist[1].scores!.positive).toBeCloseTo(100)
    expect(hist[1].totalDuration).toBe(60000)
    expect(hist[2].scores).toBeNull()
  })
})

describe('recentStress', () => {
  it('now 기준 window 안 레코드만', () => {
    const now = new Date('2026-06-12T12:00:00')
    const records = [
      rec({ timestamp: new Date('2026-06-12T11:00:00'), duration: 1000, angry: 0.4 }), // 60분 전 → 제외
      rec({ timestamp: new Date('2026-06-12T11:50:00'), duration: 1000, happy: 1 }), // 10분 전 → 포함
    ]
    const s = recentStress(records, now, RECENT_WINDOW_MS)!
    expect(s.positive).toBeCloseTo(100)
    expect(s.stress).toBeCloseTo(0)
  })
})

describe('hardestPeriod', () => {
  it('N 최고 2시간 버킷 반환', () => {
    const records = [
      rec({ timestamp: new Date('2026-06-12T10:30:00'), duration: MIN_PERIOD_DURATION_MS, happy: 1 }),
      rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: MIN_PERIOD_DURATION_MS, angry: 0.4 }),
    ]
    const p = hardestPeriod(records)!
    expect(p.startHour).toBe(14) // floor(15/2)*2
    expect(p.stress).toBeCloseTo(60)
  })

  it('빈 배열 → null', () => {
    expect(hardestPeriod([])).toBeNull()
  })
})

describe('hardestPeriod 최소 측정 시간', () => {
  it('측정 시간이 MIN_PERIOD_DURATION_MS보다 짧은 시간대는 고르지 않는다', () => {
    const records = [
      rec({ timestamp: new Date('2026-06-12T10:30:00'), duration: MIN_PERIOD_DURATION_MS, sad: 0.2 }),
      rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: 10 * 1000, sad: 0.9 }), // 10초뿐
    ]
    const p = hardestPeriod(records)!
    expect(p.startHour).toBe(10)
    expect(p.stress).toBeCloseTo(20)
  })

  it('한 시간대 안의 여러 기록 시간을 합쳐서 판단한다', () => {
    const half = MIN_PERIOD_DURATION_MS / 2
    const records = [
      rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: half, sad: 0.6 }),
      rec({ timestamp: new Date('2026-06-12T15:40:00'), duration: half, sad: 0.6 }),
    ]
    expect(hardestPeriod(records)?.startHour).toBe(14)
  })

  it('경계: 1ms 모자라면 제외, 정확히 MIN_PERIOD_DURATION_MS면 포함', () => {
    const at = new Date('2026-06-12T15:10:00')
    expect(hardestPeriod([rec({ timestamp: at, duration: MIN_PERIOD_DURATION_MS - 1, sad: 0.5 })])).toBeNull()
    expect(hardestPeriod([rec({ timestamp: at, duration: MIN_PERIOD_DURATION_MS, sad: 0.5 })])?.startHour).toBe(14)
  })

  it('하루 합계가 5분이어도 시간대마다 5분 미만이면 null', () => {
    const third = MIN_PERIOD_DURATION_MS / 3
    const records = ['09:10', '13:10', '17:10'].map((t) =>
      rec({ timestamp: new Date(`2026-06-12T${t}:00`), duration: third, sad: 0.5 }),
    )
    expect(hardestPeriod(records)).toBeNull()
  })

  it('조건을 채우는 시간대가 없으면 null', () => {
    const records = [rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: 60 * 1000, sad: 0.9 })]
    expect(hardestPeriod(records)).toBeNull()
  })

  it('최소 시간을 직접 줄 수 있다', () => {
    const records = [rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: 60 * 1000, sad: 0.9 })]
    expect(hardestPeriod(records, 0)?.startHour).toBe(14)
  })
})
