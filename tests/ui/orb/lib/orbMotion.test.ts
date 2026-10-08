import { describe, it, expect } from 'vitest'
import { motionFor } from '@/features/ui/orb/lib/orbMotion'

describe('motionFor', () => {
  it('평온 = 느리고 깊은 숨, 부유 없음', () => {
    const m = motionFor('calm')
    expect(m.breathPeriodMs).toBe(5000)
    expect(m.floatY).toBe(0)
    expect(m.jitter).toBe(false)
  })
  it('기쁨 = 빠른 숨 + 위로 부유(floatY<0)', () => {
    const m = motionFor('happy')
    expect(m.breathPeriodMs).toBeLessThan(motionFor('calm').breathPeriodMs)
    expect(m.floatY).toBeLessThan(0)
  })
  it('슬픔 = 느리고 얕은 숨 + 가라앉음(floatY>0)', () => {
    const m = motionFor('sad')
    expect(m.breathPeriodMs).toBeGreaterThan(motionFor('calm').breathPeriodMs)
    expect(m.breathAmp).toBeLessThan(motionFor('calm').breathAmp)
    expect(m.floatY).toBeGreaterThan(0)
  })
  it('화남 = 빠른 숨, 단 떨림(jitter)은 없음', () => {
    const m = motionFor('angry')
    expect(m.breathPeriodMs).toBeLessThan(motionFor('calm').breathPeriodMs)
    expect(m.jitter).toBe(false)
  })
})
