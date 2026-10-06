export type OrbStage = 'empty' | 'awakening' | 'forming' | 'settled' | 'living'

export const STAGE_THRESHOLDS = {
  empty: 0,
  awakening: 1,
  forming: 4,
  settled: 11,
  living: 31,
} as const satisfies Record<OrbStage, number>

export const STAGE_ORDER = [
  'empty',
  'awakening',
  'forming',
  'settled',
  'living',
] as const satisfies readonly OrbStage[]

export const STAGE_MESSAGES = {
  empty: '아직 당신을 모릅니다',
  awakening: '조금씩 느껴지기 시작',
  forming: '당신의 결이 보이기 시작',
  settled: '당신의 결이 분명해집니다',
  living: '당신과 함께 살아갑니다',
} as const satisfies Record<OrbStage, string>

export function stageFromCount(count: number): OrbStage {
  if (count >= STAGE_THRESHOLDS.living) return 'living'
  if (count >= STAGE_THRESHOLDS.settled) return 'settled'
  if (count >= STAGE_THRESHOLDS.forming) return 'forming'
  if (count >= STAGE_THRESHOLDS.awakening) return 'awakening'
  return 'empty'
}

const OPACITY_FULL_COUNT = 31
const OPACITY_CURVE_DENOMINATOR = Math.log(36)

export function opacityFromCount(count: number): number {
  // 새 계정(0건)도 또렷하게 보이도록 floor를 0.55로. 쓸수록 1.0까지 성장(span 0.45).
  if (count <= 0) return 0.55
  if (count >= OPACITY_FULL_COUNT) return 1
  return 0.55 + 0.45 * (Math.log(count + 1) / OPACITY_CURVE_DENOMINATOR)
}
