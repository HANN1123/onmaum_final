import { describe, expect, it } from 'vitest'
import { classifyStress, type BaselineState } from '@/features/algorithm/baseline/baseline'
import { gaugePosition } from '@/features/ui/measure/demo/gaugePosition'

const absolute: BaselineState = { mode: 'absolute', baselineN: null }
const relative: BaselineState = { mode: 'relative', baselineN: 30 }

/** 위치가 몇 번째 칸(0~3)에 들어가는지 */
const cell = (pos: number) => Math.floor(pos * 4)

describe('스트레스 게이지 ▲ 위치', () => {
  it('▲는 항상 기존 판정이 낸 단계의 칸 안에 놓인다', () => {
    for (const baseline of [absolute, relative]) {
      for (let v = 0; v <= 100; v += 1) {
        const level = classifyStress(v, baseline)
        const pos = gaugePosition(v, level, baseline)
        expect(cell(pos)).toBe(['low', 'typical', 'high', 'veryHigh'].indexOf(level))
      }
    }
  })

  it('같은 칸 안에서는 값이 클수록 오른쪽에 놓인다', () => {
    // 절대 기준 보통 칸(15~30)
    expect(gaugePosition(18, 'typical', absolute)).toBeLessThan(gaugePosition(27, 'typical', absolute))
    // 기준선 30 대비 보통 칸(24~37.5)
    expect(gaugePosition(25, 'typical', relative)).toBeLessThan(gaugePosition(35, 'typical', relative))
  })

  it('값이 칸 경계에 있어도 칸 끝에 붙지 않는다', () => {
    expect(gaugePosition(0, 'low', absolute)).toBeCloseTo(0.02, 5)
    expect(gaugePosition(100, 'veryHigh', absolute)).toBeCloseTo(0.98, 5)
  })

  it('기준선 대비로는 높지만 절대 하한 미만이라 보통으로 판정된 값은 보통 칸에 남는다', () => {
    const low: BaselineState = { mode: 'relative', baselineN: 10 }
    const level = classifyStress(18, low)
    expect(level).toBe('typical')
    expect(cell(gaugePosition(18, level, low))).toBe(1)
  })
})
