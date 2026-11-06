import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSessionLog } from '@/features/ui/measure/demo/useSessionLog'
import { parseDemoSession, readDemoSessionRaw } from '@/features/ui/measure/demo/sessionLog'
import type { RppgQuality } from '@/features/rppg/engine/rppgGate'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); sessionStorage.clear() })

it('매초 표시 심박·원래 심박·품질을 함께 기록하고 종료 표본도 보존한다', () => {
  vi.useFakeTimers()
  const { result, rerender } = renderHook(({ bpm, quality }: { bpm: number | null; quality: RppgQuality | null }) => useSessionLog(true, bpm, 'calm', quality, bpm === null ? null : 140), { initialProps: { bpm: 72 as number | null, quality: 'motion' as RppgQuality | null } })
  act(() => vi.advanceTimersByTime(1000))
  rerender({ bpm: null, quality: null })
  act(() => vi.advanceTimersByTime(1500))
  let recorded: ReturnType<typeof result.current>
  act(() => { recorded = result.current() })
  expect(recorded!.samples[1]).toMatchObject({ t: 1, bpm: 72, rawBpm: 140, quality: 'motion' })
  expect(recorded!.samples.at(-1)).toMatchObject({ t: 3, bpm: null, rawBpm: null })
  expect(recorded!.samples.at(-1)?.quality).toBeUndefined()
  expect(parseDemoSession(readDemoSessionRaw())?.samples[1].quality).toBe('motion')
})

it('원수신 워치·나이·접촉과 rPPG 메타데이터를 함께 남기고 만료 시점에 다시 선택한다', () => {
  vi.useFakeTimers()
  let now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { result } = renderHook(() => useSessionLog(true, 90, null, 'motion', 140,
    { latest: { t: 1000, bpm: 90, contact: 'good' }, status: 'connected', rppgBpm: 72 }))
  now = 9000
  act(() => vi.advanceTimersByTime(1000))
  now = 9001
  act(() => vi.advanceTimersByTime(1000))
  const recorded = result.current()
  expect(recorded.samples[1]).toMatchObject({ bpm: 90, source: 'watch', watchBpm: 90, watchAgeMs: 8000, watchContact: 'good', rppgBpm: 72, quality: 'motion', rawBpm: 140 })
  expect(recorded.samples[2]).toMatchObject({ bpm: 72, source: 'rppg', watchBpm: 90, watchAgeMs: 8001 })
})

it('측정 중 연결·접촉 불량·해제·재시작을 반영하고 선택값이 없으면 출처를 생략한다', () => {
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  type Props = { active: boolean; status: 'idle' | 'connected'; contact: 'good' | 'poor' }
  const { result, rerender } = renderHook(({ active, status, contact }: Props) => useSessionLog(active, null, null, null, null,
    { latest: { t: 1000, bpm: 90, contact }, status, rppgBpm: null }),
  { initialProps: { active: true, status: 'idle', contact: 'good' } as Props })
  act(() => vi.advanceTimersByTime(1000))
  rerender({ active: true, status: 'connected', contact: 'good' })
  act(() => vi.advanceTimersByTime(1000))
  rerender({ active: true, status: 'connected', contact: 'poor' })
  act(() => vi.advanceTimersByTime(1000))
  rerender({ active: true, status: 'idle', contact: 'good' })
  act(() => vi.advanceTimersByTime(1000))
  const samples = result.current().samples
  expect(samples.map((p) => p.source)).toEqual([undefined, undefined, 'watch', undefined, undefined])
  expect(samples[3].watchContact).toBe('poor')
  rerender({ active: false, status: 'idle', contact: 'good' })
  act(() => vi.advanceTimersByTime(2000))
  rerender({ active: true, status: 'connected', contact: 'good' })
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current().samples.map((p) => p.source)).toEqual(['watch', 'watch'])
})
