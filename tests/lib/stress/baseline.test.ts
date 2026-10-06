import { describe, it, expect } from 'vitest'
import {
  computeBaselineState,
  classifyStress,
  MIN_VALID_DAY_DURATION_MS,
} from '@/lib/stress/baseline'
import type { DailyStressPoint } from '@/lib/stress/dailyStress'

function pt(date: string, stress: number | null, totalDuration: number): DailyStressPoint {
  return {
    date,
    scores: stress === null ? null : { positive: 0, stress },
    totalDuration,
  }
}

const FIVE_MIN = MIN_VALID_DAY_DURATION_MS

describe('computeBaselineState', () => {
  it('유효일 < MIN_VALID_DAYS → absolute', () => {
    const hist = [pt('d1', 40, FIVE_MIN), pt('d2', 40, FIVE_MIN), pt('today', 50, FIVE_MIN)]
    expect(computeBaselineState(hist)).toEqual({ mode: 'absolute', baselineN: null })
  })

  it('유효일 >= MIN_VALID_DAYS → relative, baselineN = median(오늘 제외)', () => {
    const hist = [
      pt('d1', 10, FIVE_MIN),
      pt('d2', 20, FIVE_MIN),
      pt('d3', 60, FIVE_MIN),
      pt('today', 99, FIVE_MIN), // 오늘은 제외
    ]
    expect(computeBaselineState(hist)).toEqual({ mode: 'relative', baselineN: 20 })
  })

  it('측정 부족일(5분 미만)·빈 날은 유효일에서 제외', () => {
    const hist = [
      pt('d1', 30, FIVE_MIN),
      pt('d2', 30, FIVE_MIN - 1), // 부족
      pt('d3', null, 0), // 빈 날
      pt('today', 30, FIVE_MIN),
    ]
    expect(computeBaselineState(hist).mode).toBe('absolute') // 유효일 1개뿐
  })
})

describe('classifyStress (absolute)', () => {
  const abs = { mode: 'absolute' as const, baselineN: null }
  it('밴드 경계', () => {
    expect(classifyStress(10, abs)).toBe('low') // <15
    expect(classifyStress(15, abs)).toBe('typical') // 15~30
    expect(classifyStress(30, abs)).toBe('typical')
    expect(classifyStress(40, abs)).toBe('high') // 30~50
    expect(classifyStress(60, abs)).toBe('veryHigh') // >50
  })
})

describe('classifyStress (relative)', () => {
  const rel = { mode: 'relative' as const, baselineN: 40 }
  it('비율 밴드', () => {
    expect(classifyStress(20, rel)).toBe('low') // ratio 0.5 < 0.8
    expect(classifyStress(40, rel)).toBe('typical') // ratio 1.0
    expect(classifyStress(56, rel)).toBe('high') // ratio 1.4
    expect(classifyStress(80, rel)).toBe('veryHigh') // ratio 2.0
  })

  it('절대 하한: 기준선이 낮아도 value<20이면 high 승격 안 함', () => {
    const lowBase = { mode: 'relative' as const, baselineN: 5 }
    expect(classifyStress(15, lowBase)).toBe('typical') // ratio 3.0이지만 value<20
    expect(classifyStress(25, lowBase)).toBe('veryHigh') // value>=20 → 승격
  })
})
