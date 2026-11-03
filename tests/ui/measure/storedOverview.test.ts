import { describe, it, expect } from 'vitest'
import { classifyStress, computeBaselineState } from '@/features/algorithm/baseline/baseline'
import { dailyStressHistory } from '@/features/algorithm/stress/dailyStress'
import { buildStoredOverview, dayLevelCopy, levelShort } from '@/features/ui/measure/demo/storedOverview'
import type { EmotionRecord, MeasurementSession } from '@/shared/storage/db'

const NOW = new Date('2026-11-04T15:00:00')

function record(timestamp: string, mix: Partial<Pick<EmotionRecord, 'happy' | 'calm' | 'sad' | 'angry'>>, sessionId?: string): EmotionRecord {
  return {
    id: 0,
    timestamp: new Date(timestamp),
    duration: 10 * 60 * 1000,
    detectionRate: 1,
    happy: 0,
    calm: 1,
    sad: 0,
    angry: 0,
    ...mix,
    dominantEmotion: 'calm',
    flatAffectScore: 0,
    ...(sessionId ? { sessionId } : {}),
  }
}

function session(id: string, startedAt: string, endedAt: string | null): MeasurementSession {
  return {
    id,
    startedAt: new Date(startedAt),
    endedAt: endedAt ? new Date(endedAt) : null,
    status: endedAt ? 'completed' : 'active',
    endReason: endedAt ? 'user-stop' : null,
    lastSeenAt: new Date(endedAt ?? startedAt),
  }
}

describe('buildStoredOverview', () => {
  it('기록이 없으면 14일 모두 비어 있고 오늘 판정도 없다', () => {
    const o = buildStoredOverview([], [], NOW, 0)
    expect(o.days).toHaveLength(14)
    expect(o.days.every((d) => d.stress === null && d.level === null)).toBe(true)
    expect(o.today.level).toBeNull()
    expect(o.today.shares).toBeNull()
    expect(o.today.sessions).toEqual([])
    expect(o.days[13].isToday).toBe(true)
  })

  it('판정은 기존 알고리즘(dailyStressHistory → computeBaselineState → classifyStress)과 같고, 오늘만 보정값을 더한다', () => {
    const records = [
      record('2026-11-01T10:00:00', { calm: 0.8, sad: 0.2 }),
      record('2026-11-02T10:00:00', { calm: 0.8, sad: 0.2 }),
      record('2026-11-03T10:00:00', { calm: 0.8, sad: 0.2 }),
      record('2026-11-04T10:00:00', { calm: 0.6, sad: 0.4 }),
    ]
    const o = buildStoredOverview(records, [], NOW, 6)
    const baseline = computeBaselineState(dailyStressHistory(records, 14, NOW))
    expect(o.baseline).toEqual(baseline)
    expect(o.days[12].stress).toBeCloseTo(20)
    expect(o.today.stress).toBeCloseTo(46)
    expect(o.today.level).toBe(classifyStress(46, baseline))
    expect(o.validDays).toBe(3)
  })

  it('오늘 세션마다 그 세션 기록의 우세 감정과 스트레스를 붙이고 최근 것을 먼저 둔다', () => {
    const records = [
      record('2026-11-04T09:05:00', { calm: 0.2, angry: 0.8 }, 'a'),
      record('2026-11-04T13:05:00', { calm: 0.9, happy: 0.1 }, 'b'),
    ]
    const sessions = [
      session('a', '2026-11-04T09:00:00', '2026-11-04T09:20:00'),
      session('b', '2026-11-04T13:00:00', null),
      session('old', '2026-11-03T13:00:00', '2026-11-03T13:10:00'),
    ]
    const o = buildStoredOverview(records, sessions, NOW, 0)
    expect(o.today.sessions.map((s) => s.id)).toEqual(['b', 'a'])
    expect(o.today.sessions[1]).toMatchObject({ dominant: 'angry', durationSec: 1200, active: false })
    expect(o.today.sessions[1].stress).toBeCloseTo(80)
    expect(o.today.sessions[0]).toMatchObject({ dominant: 'calm', active: true })
    expect(o.days[13].sessions).toBe(2)
    expect(o.days[12].sessions).toBe(1)
  })
})

describe('판정 문구', () => {
  it('기준선이 없으면(기록 3일 미만) "평소" 비교 표현을 쓰지 않는다', () => {
    const absolute = { mode: 'absolute' as const, baselineN: null }
    expect(levelShort('high', absolute)).toBe('높음')
    expect(dayLevelCopy('high', absolute)).not.toContain('평소')
    expect(levelShort('high', { mode: 'relative', baselineN: 20 })).toBe('평소보다 높음')
  })
})
