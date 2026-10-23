export const OFFSET_MAX = 15
export const OFFSET_STEP = 3

/** 맞아요 / 더 힘들었어요 / 사실 괜찮았어요 */
export type SelfReport = 'agree' | 'worse' | 'better'

/**
 * 체크인 응답으로 보정값(점수)을 갱신한다.
 * "맞아요"는 지금 보정된 판정이 맞다는 뜻이므로 보정값을 유지한다(이전에는 0쪽으로 1씩 줄였다).
 * 단계·상한·유지 규칙의 근거와 시뮬레이션 검증: docs/architecture/CALIBRATION_DESIGN.md
 */
export function nextOffset(current: number, report: SelfReport): number {
  let next = current
  if (report === 'worse') next = current + OFFSET_STEP
  else if (report === 'better') next = current - OFFSET_STEP
  return Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, next))
}

export function applyOffset(n: number, offset: number): number {
  return Math.max(0, Math.min(100, n + offset))
}
