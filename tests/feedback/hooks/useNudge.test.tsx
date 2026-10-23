import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '@/shared/storage/db'
import { useNudge } from '@/features/feedback/hooks/useNudge'
import { saveSettings, DEFAULT_SETTINGS } from '@/shared/storage/settings'
import { loadNudgeDayState } from '@/shared/storage/dayState'

// 실제 시각을 쓰면 자정 직후에 "1분 전" 기록이 전날로 넘어가 오늘 기록 조회에서 빠진다.
// Date만 고정하고 타이머는 실제로 두어 useLiveQuery·waitFor 동작을 유지한다.
const FIXED_NOW = new Date('2026-06-12T14:00:00')

describe('useNudge', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)
    localStorage.clear()
    await db.emotions.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal(
      'Notification',
      Object.assign(
        vi.fn().mockImplementation(() => ({ onclick: null, close: vi.fn() })),
        { permission: 'granted' },
      ),
    )
  })

  it('지속 high + 토글 ON → 배너 open + dayState 증가', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      nudge: { ...DEFAULT_SETTINGS.nudge, enabled: true, sustainMs: 0 },
    })
    const now = new Date()
    // 최근 30분 내 high N 레코드
    await db.emotions.add({
      timestamp: new Date(now.getTime() - 60 * 1000),
      duration: 60000,
      detectionRate: 1,
      happy: 0,
      calm: 0,
      sad: 0,
      angry: 0.5, // N = 50
      dominantEmotion: 'angry',
      flatAffectScore: 0,
    } as never)

    const { result } = renderHook(() => useNudge())
    await vi.waitFor(() => expect(result.current.bannerOpen).toBe(true))
    const date = now.toLocaleDateString('en-CA')
    expect(loadNudgeDayState(date).count).toBe(1)
  })

  it('토글 OFF → 배너 안 뜸', async () => {
    const now = new Date()
    await db.emotions.add({
      timestamp: new Date(now.getTime() - 60 * 1000),
      duration: 60000,
      detectionRate: 1,
      happy: 0, calm: 0, sad: 0, angry: 0.5,
      dominantEmotion: 'angry', flatAffectScore: 0,
    } as never)
    const { result } = renderHook(() => useNudge())
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.bannerOpen).toBe(false)
  })
})
