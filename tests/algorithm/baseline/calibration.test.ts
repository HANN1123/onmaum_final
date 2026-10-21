import { describe, it, expect } from 'vitest'
import { nextOffset, applyOffset, OFFSET_MAX, OFFSET_STEP } from '@/features/algorithm/baseline/calibration'

describe('nextOffset', () => {
  it("'worse' → +STEP, 'better' → -STEP", () => {
    expect(nextOffset(0, 'worse')).toBe(OFFSET_STEP)
    expect(nextOffset(0, 'better')).toBe(-OFFSET_STEP)
  })

  it("'agree' → 보정값 유지 (보정된 판정이 맞다는 응답)", () => {
    expect(nextOffset(6, 'agree')).toBe(6)
    expect(nextOffset(-6, 'agree')).toBe(-6)
    expect(nextOffset(0, 'agree')).toBe(0)
  })

  it('±OFFSET_MAX 클램프', () => {
    expect(nextOffset(OFFSET_MAX, 'worse')).toBe(OFFSET_MAX)
    expect(nextOffset(-OFFSET_MAX, 'better')).toBe(-OFFSET_MAX)
  })

  it('상한에 닿아도 반대 응답 한 번으로 한 단계 돌아온다', () => {
    expect(nextOffset(OFFSET_MAX, 'better')).toBe(OFFSET_MAX - OFFSET_STEP)
    expect(nextOffset(-OFFSET_MAX, 'worse')).toBe(-OFFSET_MAX + OFFSET_STEP)
  })

  it('체감이 바뀌면(더 힘들다 → 괜찮다) 보정값도 따라 내려온다', () => {
    let o = 0
    for (let i = 0; i < 5; i++) o = nextOffset(o, 'worse')
    expect(o).toBe(OFFSET_MAX)
    for (let i = 0; i < 3; i++) o = nextOffset(o, 'agree')
    expect(o).toBe(OFFSET_MAX)
    for (let i = 0; i < 5; i++) o = nextOffset(o, 'better')
    expect(o).toBe(0)
  })
})

describe('applyOffset', () => {
  it('N+offset, 0~100 클램프', () => {
    expect(applyOffset(50, 3)).toBe(53)
    expect(applyOffset(99, 5)).toBe(100)
    expect(applyOffset(2, -5)).toBe(0)
  })
})
