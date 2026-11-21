import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLivePulse } from '@/features/ui/measure/demo/demoBits'
import { STRESS_BEAT_PER_MIN } from '@/features/ui/measure/demo/orbs/stressPalette'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 10ms 간격으로 맥박 값을 읽어 0.5 를 위로 넘는 시각(초)을 모은다. 오브는 이 순간마다 한 번 반짝인다 */
function flashTimes(perMin: number, seconds: number): number[] {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { result } = renderHook(() => useLivePulse(perMin))
  const times: number[] = []
  let prev = 0
  for (; now <= seconds * 1000; now += 10) {
    const v = result.current()
    if (prev < 0.5 && v >= 0.5) times.push(now / 1000)
    prev = v
  }
  return times
}

describe('오브 반짝임 간격', () => {
  it('스트레스 단계가 높을수록 자주 반짝인다', () => {
    const { low, typical, high, veryHigh } = STRESS_BEAT_PER_MIN
    expect(low).toBeLessThan(typical)
    expect(typical).toBeLessThan(high)
    expect(high).toBeLessThan(veryHigh)
  })

  it('한 단계 안에서는 반짝임 간격이 일정하고, 한 박에 한 번만 반짝인다', () => {
    for (const perMin of Object.values(STRESS_BEAT_PER_MIN)) {
      const times = flashTimes(perMin, 12)
      const gaps = times.slice(1).map((t, i) => t - times[i])
      expect(gaps.length).toBeGreaterThan(3)
      for (const gap of gaps) expect(gap).toBeCloseTo(60 / perMin, 1)
    }
  })
})
