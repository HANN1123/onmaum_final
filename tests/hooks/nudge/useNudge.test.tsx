import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '@/lib/storage/db'
import { useNudge } from '@/hooks/nudge/useNudge'
import { saveSettings, DEFAULT_SETTINGS } from '@/lib/storage/settings'
import { loadNudgeDayState } from '@/lib/storage/dayState'

describe('useNudge', () => {
  beforeEach(async () => {
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
      angry: 0.5, // N = 75
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
