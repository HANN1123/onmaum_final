import { describe, expect, it } from 'vitest'
import {
  fusedScore,
  heartBaseline,
  heartRiseScore,
  liveFusedState,
  negativeShare,
  HR_SIGMA_FLOOR,
  MIN_REF_SAMPLES,
  REF_WINDOW_SEC,
  type FusedSample,
} from '@/features/algorithm/stress/fusedStress'

describe('heartRiseScore: 기준 심박 대비 상승 점수', () => {
  // STRESS_FUSION_RULE.md 5절 예시: μ = 72, σ = 4, δ = 3, Z_MAX = 3
  const base = { mu: 72, sigma: 4 }

  it('기준보다 낮거나 불감대(3 BPM) 이내면 0', () => {
    expect(heartRiseScore(70, base)).toBe(0)
    expect(heartRiseScore(75, base)).toBe(0)
  })

  it('문서 예시 값과 같다 (78 → 25, 84 → 75)', () => {
    expect(heartRiseScore(78, base)).toBeCloseTo(25)
    expect(heartRiseScore(84, base)).toBeCloseTo(75)
  })

  it('상한은 100', () => {
    expect(heartRiseScore(95, base)).toBe(100)
  })

  it('심박이나 기준이 없으면 null', () => {
    expect(heartRiseScore(null, base)).toBeNull()
    expect(heartRiseScore(80, null)).toBeNull()
  })
})

describe('fusedScore: 표정 점수와 심박 상승의 결합', () => {
  it('문서 예시 값과 같다', () => {
    expect(fusedScore(30, 0)).toBe(30)
    expect(fusedScore(30, 25)).toBeCloseTo(32.625)
    expect(fusedScore(30, 75)).toBeCloseTo(37.875)
    expect(fusedScore(30, 100)).toBeCloseTo(40.5)
    expect(fusedScore(80, 100)).toBeCloseTo(88)
  })

  it('부정 표정이 없으면 심박이 올라도 0', () => {
    expect(fusedScore(0, 100)).toBe(0)
  })

  it('심박 상승 점수가 없으면 표정 점수 그대로', () => {
    expect(fusedScore(42, null)).toBe(42)
  })

  it('결합 강도 0 이면 표정 점수 그대로', () => {
    expect(fusedScore(42, 100, 0)).toBe(42)
  })

  it('100 을 넘지 않는다', () => {
    for (let n = 0; n <= 100; n += 5) expect(fusedScore(n, 100)).toBeLessThanOrEqual(100)
  })
})

describe('heartBaseline: 기준 심박과 흔들림', () => {
  it('중앙값과 1.4826 × MAD (하한 3 BPM)', () => {
    expect(heartBaseline([70, 72, 74])).toEqual({ mu: 72, sigma: HR_SIGMA_FLOOR })
    const wide = heartBaseline([60, 70, 80, 90, 100])!
    expect(wide.mu).toBe(80)
    expect(wide.sigma).toBeCloseTo(1.4826 * 10)
  })

  it('범위(40~180) 밖 값은 빼고, 남는 값이 없으면 null', () => {
    expect(heartBaseline([20, 72, 250])).toEqual({ mu: 72, sigma: HR_SIGMA_FLOOR })
    expect(heartBaseline([10, 300])).toBeNull()
  })
})

describe('negativeShare', () => {
  it('슬픔 + 화남 확률', () => {
    expect(negativeShare({ happy: 0.1, calm: 0.5, sad: 0.15, angry: 0.25 })).toBeCloseTo(0.4)
  })
})

describe('liveFusedState: 세션 단위 실시간 결합', () => {
  /** 0..end 초까지 1초 표본. bpm·neg 는 시각별 함수 */
  function series(end: number, bpm: (t: number) => number | null, neg: (t: number) => number | null): FusedSample[] {
    return Array.from({ length: end + 1 }, (_, t) => ({ t, bpm: bpm(t), neg: neg(t) }))
  }

  it('표정 값이 최근 구간의 절반 미만이면 null', () => {
    const s = series(60, () => 72, (t) => (t < 50 ? null : 0.3))
    expect(liveFusedState(s, 60)).toBeNull()
  })

  it('첫 2분 동안은 기준 심박이 없어 S = N', () => {
    const s = series(90, () => 72, () => 0.3)
    const r = liveFusedState(s, 90)!
    expect(r.baseline).toBeNull()
    expect(r.a).toBeNull()
    expect(r.n).toBeCloseTo(30)
    expect(r.s).toBeCloseTo(30)
  })

  it('기준 구간 뒤 심박이 오르면 S 가 N 보다 커진다', () => {
    const s = series(240, (t) => (t < REF_WINDOW_SEC ? 72 : 95), () => 0.3)
    const r = liveFusedState(s, 240)!
    expect(r.baseline).toEqual({ mu: 72, sigma: HR_SIGMA_FLOOR })
    expect(r.hr).toBe(95)
    expect(r.a).toBe(100)
    expect(r.s).toBeCloseTo(40.5)
  })

  it('부정 표정이 없으면 심박이 올라도 S = 0', () => {
    const s = series(240, (t) => (t < REF_WINDOW_SEC ? 72 : 95), () => 0)
    expect(liveFusedState(s, 240)!.s).toBe(0)
  })

  it('기준 구간 유효 심박이 모자라면 기준을 만들지 않는다', () => {
    const s = series(240, (t) => (t < REF_WINDOW_SEC - MIN_REF_SAMPLES + 10 ? null : 72), () => 0.3)
    expect(liveFusedState(s, 240)!.baseline).toBeNull()
  })

  it('최근 심박 표본이 모자라면 hr = null 이고 S = N', () => {
    const s = series(240, (t) => (t < REF_WINDOW_SEC ? 72 : t > 220 ? 95 : null), () => 0.3)
    const r = liveFusedState(s, 240)!
    expect(r.hr).toBeNull()
    expect(r.s).toBeCloseTo(30)
  })
})
