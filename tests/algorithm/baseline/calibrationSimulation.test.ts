import { describe, it, expect } from 'vitest'
import { nextOffset, applyOffset, type SelfReport } from '@/features/algorithm/baseline/calibration'
import { classifyStress, type StressLevel } from '@/features/algorithm/baseline/baseline'

/**
 * 합성 사용자 시뮬레이션으로 체크인 보정 규칙을 검증한다. 실제 판정·보정 함수를 그대로 쓴다.
 * 설계와 결과 해석: docs/architecture/CALIBRATION_DESIGN.md
 *
 * - 사용자: 평소 부정 정서 B(8~60), 측정값과 체감의 어긋남 bias(-0.3~+0.3)
 * - 체감 모델 두 가지: 비율로 어긋남(ratio) / 점수로 어긋남(additive). 실제 사용자가 어느 쪽인지는 모른다
 * - 하루 2회 체크인, 40% 미응답, 15% 무작위 응답
 * - 지표: 15~30일차에 보여 준 판정이 체감 판정과 같은 비율, 두 단계 이상 어긋난 비율
 */

const LEVEL_ORDER: StressLevel[] = ['low', 'typical', 'high', 'veryHigh']
const rank = (l: StressLevel) => LEVEL_ORDER.indexOf(l)
const clamp = (v: number) => Math.max(0, Math.min(100, v))

type Model = 'ratio' | 'additive'
type Update = (offset: number, report: SelfReport) => number

/** 감쇠가 있던 이전 규칙 (비교용) */
const previousRule: Update = (o, r) => {
  if (r === 'worse') return Math.min(15, o + 3)
  if (r === 'better') return Math.max(-15, o - 3)
  if (o > 0) return o - 1
  if (o < 0) return o + 1
  return o
}
const noCalibration: Update = () => 0

function makeRandom(seed: number) {
  let s = seed
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  const gauss = () => {
    const u = rnd() || 1e-9
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
  }
  return { rnd, gauss }
}

function simulate(update: Update, model: Model) {
  let agree = 0
  let severe = 0
  let total = 0
  for (const B of [8, 15, 25, 40, 60]) {
    const baseline = { mode: 'relative' as const, baselineN: B }
    for (const bias of [-0.3, -0.15, 0, 0.15, 0.3]) {
      for (let rep = 0; rep < 20; rep++) {
        const { rnd, gauss } = makeRandom(B * 1000 + Math.round(bias * 100) + rep * 7 + (model === 'ratio' ? 2 : 3))
        let offset = 0
        for (let day = 0; day < 30; day++) {
          for (let slot = 0; slot < 2; slot++) {
            const n = clamp(B * Math.exp(0.3 * gauss()))
            const shown = classifyStress(applyOffset(n, offset), baseline)
            const feltValue = model === 'ratio' ? clamp(n * (1 + bias)) : clamp(n + bias * 50)
            const felt = classifyStress(feltValue, baseline)
            if (day >= 14) {
              total++
              if (shown === felt) agree++
              if (Math.abs(rank(shown) - rank(felt)) >= 2) severe++
            }
            if (rnd() < 0.4) continue
            let report: SelfReport = rank(shown) < rank(felt) ? 'worse' : rank(shown) > rank(felt) ? 'better' : 'agree'
            if (rnd() < 0.15) report = (['worse', 'better', 'agree'] as const)[Math.floor(rnd() * 3)]
            offset = update(offset, report)
          }
        }
      }
    }
  }
  return { agreement: agree / total, severe: severe / total }
}

describe('체크인 보정 시뮬레이션 검증', () => {
  for (const model of ['ratio', 'additive'] as const) {
    describe(`체감 모델: ${model}`, () => {
      const current = simulate(nextOffset, model)
      const previous = simulate(previousRule, model)
      const none = simulate(noCalibration, model)

      it('현재 규칙은 보정이 없을 때보다 체감과 더 잘 맞는다', () => {
        expect(current.agreement).toBeGreaterThan(none.agreement + 0.1)
      })

      it('"맞아요"에서 보정을 유지하는 현재 규칙이 감쇠하던 이전 규칙보다 낫다', () => {
        expect(current.agreement).toBeGreaterThan(previous.agreement)
      })

      it('15~30일차에 80% 이상 일치하고, 두 단계 이상 어긋남은 2% 미만이다', () => {
        expect(current.agreement).toBeGreaterThanOrEqual(0.8)
        expect(current.severe).toBeLessThan(0.02)
      })
    })
  }
})
