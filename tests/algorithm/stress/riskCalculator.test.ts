import { describe, it, expect } from 'vitest'
import { ANGRY_WEIGHT } from '@/features/algorithm/stress/riskCalculator'

describe('riskCalculator 상수', () => {
  it('ANGRY_WEIGHT = 1.5', () => {
    expect(ANGRY_WEIGHT).toBe(1.5)
  })
})
