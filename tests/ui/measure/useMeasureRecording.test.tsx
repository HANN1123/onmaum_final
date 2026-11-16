import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import type { EmotionRecordInput } from '@/shared/storage/emotionRepository'
import type { RecorderDeps } from '@/features/ui/measure/demo/measureRecorder'
import { KEEP_ALIVE_TICK_MS, useMeasureRecording } from '@/features/ui/measure/demo/useMeasureRecording'

const CALM: EmotionResult = { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 }

beforeEach(() => vi.useFakeTimers({ now: 0 }))
afterEach(() => vi.useRealTimers())

function storageDeps() {
  const saved: EmotionRecordInput[] = []
  const touched: number[] = []
  const deps: RecorderDeps = {
    startSession: async () => ({ id: 's1' }),
    touchSession: async (_id, at) => { touched.push(at.getTime()) },
    endSession: async () => {},
    saveRecord: async (r) => { saved.push(r); return saved.length },
    now: () => Date.now(),
  }
  return { deps, saved, touched }
}

it('호흡 안내(paused) 동안 표본은 버리고 그 전 표본은 멈춘 시각으로 저장하며, 세션 생존 갱신은 계속한다', async () => {
  const { deps, saved, touched } = storageDeps()
  const { result, rerender } = renderHook(
    ({ paused }) => useMeasureRecording(true, { nominalIntervalMs: 250, paused, deps }),
    { initialProps: { paused: false } },
  )
  await act(async () => {
    for (let i = 0; i < 40; i++) {
      await vi.advanceTimersByTimeAsync(250)
      result.current.push(CALM)
    }
  })
  rerender({ paused: true })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150_000 - Date.now())
  })
  result.current.push(CALM)
  await act(async () => { await result.current.stop() })
  expect(saved).toHaveLength(1)
  expect(saved[0].timestamp.getTime()).toBe(10_000)
  // 표본이 없었던 호흡 안내 중에도 30초마다 갱신했다
  expect(touched).toEqual([30_000, 60_000, 90_000, 120_000, 150_000])
  expect(KEEP_ALIVE_TICK_MS).toBeLessThan(30_000)
})
