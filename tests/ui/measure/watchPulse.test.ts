import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLivePulse } from '@/features/ui/measure/demo/demoBits'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('수신 BPM이 바뀌어도 같은 시각의 위상과 함수 참조를 유지한다', () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { result, rerender } = renderHook(({ bpm }) => useLivePulse(bpm), { initialProps: { bpm: 60 } })
  const getPulse = result.current
  now = 160
  const before = getPulse()
  rerender({ bpm: 120 })
  expect(result.current).toBe(getPulse)
  expect(getPulse()).toBeCloseTo(before, 12)
  now = 300
  // 60 BPM에서 0.16까지 진행한 뒤 120 BPM으로 0.28을 더해 위상 0.44가 된다.
  expect(getPulse()).toBeCloseTo(0.32, 4)
})
