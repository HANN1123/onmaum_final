import { describe, expect, it } from 'vitest'
import { breathingAt, cycleSeconds, plannedSeconds } from '@/features/feedback/lib/breathing'

describe('breathing: 호흡 안내 진행', () => {
  it('순환 한숨 호흡은 들숨 2초 → 한 번 더 1초 → 날숨 5초를 되풀이한다', () => {
    expect(cycleSeconds('sigh')).toBe(8)
    expect(breathingAt(0, 60).step?.phase).toBe('inhale')
    expect(breathingAt(2500, 60).step?.phase).toBe('topUp')
    expect(breathingAt(3500, 60).step?.phase).toBe('exhale')
    expect(breathingAt(8100, 60)).toMatchObject({ cycle: 2, step: { phase: 'inhale' } })
  })

  it('정한 시간 안에 시작한 호흡은 날숨까지 마치고 끝난다', () => {
    // 60초 → 8초 주기 8번 = 64초
    expect(plannedSeconds(60)).toBe(64)
    expect(breathingAt(63_000, 60).done).toBe(false)
    expect(breathingAt(64_000, 60)).toMatchObject({ done: true, step: null, remainingSec: 0 })
    expect(plannedSeconds(300, 'slow')).toBe(300)
  })

  it('원 크기는 들숨에 커지고 날숨 끝에 가장 작다', () => {
    expect(breathingAt(0, 60).scale).toBe(0)
    expect(breathingAt(2000, 60).scale).toBeCloseTo(0.8)
    expect(breathingAt(3000, 60).scale).toBeCloseTo(1)
    expect(breathingAt(7999, 60).scale).toBeLessThan(0.01)
  })

  it('느린 호흡은 숨 참기 없이 들숨 4초 · 날숨 6초다', () => {
    expect(breathingAt(3900, 60, 'slow').step?.phase).toBe('inhale')
    expect(breathingAt(4100, 60, 'slow').step?.phase).toBe('exhale')
    expect(breathingAt(4100, 60, 'slow').step?.label).not.toContain('참')
  })
})
