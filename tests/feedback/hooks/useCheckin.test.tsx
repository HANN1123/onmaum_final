import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '@/shared/storage/db'
import { useCheckin } from '@/features/feedback/hooks/useCheckin'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '@/shared/storage/settings'
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
    // 두 조회가 모두 끝나 판정 문구(=context)가 준비될 때까지 기다린다
    await vi.waitFor(() => expect(result.current.line.length).toBeGreaterThan(0))

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

  it('평소 대비 판정에서 보정값이 있을 때 "맞아요"는 보정을 유지하고 근거를 저장한다', async () => {
    const now = new Date('2026-06-12T10:30:00')
    const sadRecord = (timestamp: Date, sad: number, duration: number) =>
      ({
        timestamp, duration, detectionRate: 1,
        happy: 0, calm: 1 - sad, sad, angry: 0,
        dominantEmotion: sad >= 0.5 ? 'sad' : 'calm', flatAffectScore: 0,
      }) as never
    // 지난 3일, 하루 6분씩 슬픔 0.3 → 기준선 30 (평소 대비 판정)
    for (const day of ['2026-06-09', '2026-06-10', '2026-06-11']) {
      await db.emotions.add(sadRecord(new Date(`${day}T10:00:00`), 0.3, 6 * 60000))
    }
    await db.emotions.add(sadRecord(new Date(now.getTime() - 5 * 60 * 1000), 0.6, 60000))
    saveSettings({ ...DEFAULT_SETTINGS, calibrationOffset: 6 })

    const date = now.toLocaleDateString('en-CA')
    const { result } = renderHook(() => useCheckin({ now }))
    await vi.waitFor(() => expect(result.current.line.length).toBeGreaterThan(0))
    await act(async () => {
      result.current.submit('agree')
    })

    expect(loadSettings().calibrationOffset).toBe(6)
    expect(loadCheckinEntries(date)[0].context).toEqual({
      level: 'veryHigh', // (60 + 6) / 30 = 2.2
      recentStress: 60,
      adjusted: 66,
      mode: 'relative',
      baselineN: 30,
      offsetBefore: 6,
    })
  })

  it('창 밖 → due 아님', async () => {
    const now = new Date('2026-06-12T13:00:00')
    await seedToday(now)
    const { result } = renderHook(() => useCheckin({ now }))
    await vi.waitFor(() => expect(result.current.due).toBe(false))
  })
})
