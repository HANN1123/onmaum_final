import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useWatch } from '@/features/ui/measure/demo/useWatch'
import type { WatchSample } from '@/features/rppg/lib/heartRateSource'

const device = vi.hoisted(() => ({ supported: true, status: 'connected' as 'idle' | 'connected',
  latest: null as WatchSample | null, failure: null, connect: vi.fn(), disconnect: vi.fn() }))
vi.mock('@/features/rppg/hooks/useHeartRateDevice', () => ({ useHeartRateDevice: () => device }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('마지막 알림의 8초 경계 다음에 다시 계산하고 새 알림·해제에 즉시 반응한다', () => {
  vi.useFakeTimers()
  let now = 1300
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  device.status = 'connected'
  device.latest = { t: 1000, bpm: 90, contact: 'good' }
  const { result, rerender } = renderHook(() => useWatch(70))
  expect(result.current.state).toBe('live')
  now = 9000
  act(() => vi.advanceTimersByTime(7700))
  expect(result.current.state).toBe('live')
  now = 9001
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.state).toBe('stale')
  device.latest = { t: 9001, bpm: 91, contact: 'good' }
  rerender()
  expect(result.current.state).toBe('live')
  expect(result.current.latest?.bpm).toBe(91)
  device.status = 'idle'
  device.latest = null
  rerender()
  expect(result.current.state).toBe('idle')
})
