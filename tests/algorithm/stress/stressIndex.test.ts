import { describe, it, expect } from 'vitest'
import {
  frameContribution,
  aggregateStress,
  mindBalance,
  affectEnergy,
  gateSustainedNegative,
  NEG_PRESENT_THRESHOLD,
  MIN_SUSTAIN_MS,
  emaStress,
  EMA_ALPHA,
} from '@/features/algorithm/stress/stressIndex'

describe('frameContribution', () => {
  it('pos=happy, neg=sad + angry×1.5', () => {
    const c = frameContribution({ happy: 0.5, calm: 0.2, sad: 0.1, angry: 0.2 })
    expect(c.pos).toBeCloseTo(0.5)
    expect(c.neg).toBeCloseTo(0.1 + 0.2 * 1.5) // 0.4
  })

  it('calm은 긍정에 들어가지 않는다', () => {
    const c = frameContribution({ happy: 0, calm: 1, sad: 0, angry: 0 })
    expect(c.pos).toBeCloseTo(0)
    expect(c.neg).toBeCloseTo(0)
  })
})

describe('aggregateStress', () => {
  it('빈 배열 → null', () => {
    expect(aggregateStress([])).toBeNull()
  })

  it('총 duration 0 → null', () => {
    expect(aggregateStress([{ happy: 1, sad: 0, angry: 0, duration: 0 }])).toBeNull()
  })

  it('기쁨만 가득 → 긍정 100, 스트레스 0', () => {
    const s = aggregateStress([{ happy: 1, sad: 0, angry: 0, duration: 60000 }])!
    expect(s.positive).toBeCloseTo(100)
    expect(s.stress).toBeCloseTo(0)
  })

  it('화남 0.4 → 스트레스 = 100 × (0.4×1.5) = 60', () => {
    const s = aggregateStress([{ happy: 0, sad: 0, angry: 0.4, duration: 1000 }])!
    expect(s.stress).toBeCloseTo(60)
  })

  it('duration 가중 평균 — 긴 record가 더 큰 영향', () => {
    const s = aggregateStress([
      { happy: 0, sad: 1, angry: 0, duration: 60000 },
      { happy: 1, sad: 0, angry: 0, duration: 15000 },
    ])!
    expect(s.stress).toBeCloseTo(80) // (1×60000)/75000 ×100
    expect(s.positive).toBeCloseTo(20) // (1×15000)/75000 ×100
  })
})

describe('파생값', () => {
  it('마음균형 = 긍정 − 스트레스', () => {
    expect(mindBalance({ positive: 70, stress: 40 })).toBeCloseTo(30)
  })
  it('정서활력 = 긍정 + 스트레스', () => {
    expect(affectEnergy({ positive: 70, stress: 40 })).toBeCloseTo(110)
  })
})

describe('gateSustainedNegative', () => {
  it('3초 이상 지속된 부정만 인정', () => {
    const frames = Array.from({ length: 5 }, () => ({ neg: 0.6, intervalMs: 1000 }))
    expect(gateSustainedNegative(frames)).toEqual([0.6, 0.6, 0.6, 0.6, 0.6])
  })

  it('잠깐 튄 부정(1초)은 0으로 배제', () => {
    const frames = [
      { neg: 0, intervalMs: 1000 },
      { neg: 0.6, intervalMs: 1000 }, // 단발 스파이크
      { neg: 0, intervalMs: 1000 },
    ]
    expect(gateSustainedNegative(frames)).toEqual([0, 0, 0])
  })

  it('임계 미만 부정은 부정 프레임이 아님 → 0', () => {
    const frames = Array.from({ length: 5 }, () => ({ neg: 0.2, intervalMs: 1000 }))
    expect(gateSustainedNegative(frames)).toEqual([0, 0, 0, 0, 0])
  })

  it('상수 기본값', () => {
    expect(NEG_PRESENT_THRESHOLD).toBe(0.4)
    expect(MIN_SUSTAIN_MS).toBe(3000)
  })
})

describe('emaStress', () => {
  it('이전값 null → 현재값 그대로', () => {
    expect(emaStress(null, 70)).toBe(70)
  })

  it('이전 0, 현재 100, alpha 0.5 → 50', () => {
    expect(emaStress(0, 100, 0.5)).toBeCloseTo(50)
  })

  it('기본 alpha 적용', () => {
    expect(EMA_ALPHA).toBe(0.3)
    expect(emaStress(0, 100)).toBeCloseTo(30)
  })
})
