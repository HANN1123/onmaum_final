import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '@/shared/storage/db'
import { useCheckin } from '@/features/feedback/hooks/useCheckin'
import { loadSettings } from '@/shared/storage/settings'
import { loadCheckinDone, loadCheckinEntries } from '@/shared/storage/dayState'

async function seedToday(now: Date) {
  await db.emotions.add({
    timestamp: new Date(now.getTime() - 5 * 60 * 1000),
    duration: 60000,
    detectionRate: 1,
    happy: 0,
    calm: 0,
    sad: 0,
    angry: 0.4,
    dominantEmotion: 'angry',
    flatAffectScore: 0,
  } as never)
}

describe('useCheckin', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.emotions.clear()
  })

  it('창 안 + 오늘 데이터 → due, submit 시 오프셋/엔트리 저장', async () => {
    const now = new Date('2026-06-12T10:30:00')
    await seedToday(now)
    const date = now.toLocaleDateString('en-CA')
    const { result } = renderHook(() => useCheckin({ now }))

    // liveQuery 반영 대기
    await vi.waitFor(() => expect(result.current.due).toBe(true))
    expect(result.current.slot).toBe('morning')
    expect(result.current.line.length).toBeGreaterThan(0)

    await act(async () => {
      result.current.submit('worse')
    })
    expect(loadSettings().calibrationOffset).toBeGreaterThan(0)
    expect(loadCheckinDone(date)).toContain('morning')
  })

  it('응답과 함께 그때 보여 준 판정 근거를 저장한다 (나중에 보정 규칙을 실제 응답으로 검증하기 위해)', async () => {
    const now = new Date('2026-06-12T10:30:00')
    // 화남 가중치와 무관하도록 슬픔만 쓴다: N = 0.6 × 100 = 60
    await db.emotions.add({
      timestamp: new Date(now.getTime() - 5 * 60 * 1000),
      duration: 60000,
      detectionRate: 1,
      happy: 0, calm: 0.4, sad: 0.6, angry: 0,
      dominantEmotion: 'sad',
      flatAffectScore: 0,
    } as never)
    const date = now.toLocaleDateString('en-CA')
    const { result } = renderHook(() => useCheckin({ now }))
    await vi.waitFor(() => expect(result.current.due).toBe(true))

    await act(async () => {
      result.current.submit('agree')
    })
    const [entry] = loadCheckinEntries(date)
    expect(entry.report).toBe('agree')
    expect(entry.context).toEqual({
      level: 'veryHigh', // 기록 3일 미만이라 절대 판정: 60 > 50
      recentStress: 60,
      adjusted: 60,
      mode: 'absolute',
      baselineN: null,
      offsetBefore: 0,
    })
  })

  it('창 밖 → due 아님', async () => {
    const now = new Date('2026-06-12T13:00:00')
    await seedToday(now)
    const { result } = renderHook(() => useCheckin({ now }))
    await vi.waitFor(() => expect(result.current.due).toBe(false))
  })
})
