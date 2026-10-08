import { describe, it, expect } from 'vitest'
import {
  STAGE_THRESHOLDS,
  STAGE_ORDER,
  STAGE_MESSAGES,
  stageFromCount,
  opacityFromCount,
} from '@/features/ui/orb/lib/orbStages'

describe('orbStages', () => {
  it('5단계 임계값', () => {
    expect(STAGE_THRESHOLDS).toEqual({ empty: 0, awakening: 1, forming: 4, settled: 11, living: 31 })
  })
  it('empty→living 순서', () => {
    expect(STAGE_ORDER).toEqual(['empty', 'awakening', 'forming', 'settled', 'living'])
  })
  it('단계별 한국어 메시지', () => {
    expect(STAGE_MESSAGES.empty).toBe('아직 당신을 모릅니다')
    expect(STAGE_MESSAGES.living).toBe('당신과 함께 살아갑니다')
  })
  it('누적량 → 단계', () => {
    expect(stageFromCount(0)).toBe('empty')
    expect(stageFromCount(1)).toBe('awakening')
    expect(stageFromCount(4)).toBe('forming')
    expect(stageFromCount(11)).toBe('settled')
    expect(stageFromCount(31)).toBe('living')
    expect(stageFromCount(-1)).toBe('empty')
  })
  it('누적량 → 투명도(로그)', () => {
    expect(opacityFromCount(0)).toBeCloseTo(0.55)
    expect(opacityFromCount(31)).toBeCloseTo(1.0)
    expect(opacityFromCount(9999)).toBe(1)
    expect(opacityFromCount(-5)).toBeCloseTo(0.55)
  })
})
