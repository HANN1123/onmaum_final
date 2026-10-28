import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { msUntilNextLocalMidnight, useLocalDate } from '@/features/feedback/hooks/useLocalDate'

describe('useLocalDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('다음 자정까지 남은 시간(1초 여유 포함)', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 28, 23, 59, 0))).toBe(61_000)
  })

  it('자정이 지나면 새 날짜로 다시 그린다', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 23, 59, 30))
    const { result } = renderHook(() => useLocalDate())
    expect(result.current).toBe('2026-10-28')
    act(() => {
      vi.advanceTimersByTime(31_000)
    })
    expect(result.current).toBe('2026-10-29')
  })

  it('타이머가 늦게 깨도 창이 다시 보이면 날짜를 고친다', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 28, 22, 0, 0))
    const { result } = renderHook(() => useLocalDate())
    vi.setSystemTime(new Date(2026, 9, 29, 7, 0, 0))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current).toBe('2026-10-29')
  })
})
