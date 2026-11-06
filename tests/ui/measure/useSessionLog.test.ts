import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSessionLog } from '@/features/ui/measure/demo/useSessionLog'
import { parseDemoSession, readDemoSessionRaw } from '@/features/ui/measure/demo/sessionLog'
import type { RppgQuality } from '@/features/rppg/engine/rppgGate'

afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear() })

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
