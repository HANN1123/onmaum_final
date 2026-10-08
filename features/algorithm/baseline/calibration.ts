export const OFFSET_MAX = 15
export const OFFSET_STEP = 3
export const OFFSET_DECAY = 1

/** 맞아요 / 더 힘들었어요 / 사실 괜찮았어요 */
export type SelfReport = 'agree' | 'worse' | 'better'

export function nextOffset(current: number, report: SelfReport): number {
  let next = current
  if (report === 'worse') next = current + OFFSET_STEP
  else if (report === 'better') next = current - OFFSET_STEP
  else if (current > 0) next = current - OFFSET_DECAY
  else if (current < 0) next = current + OFFSET_DECAY
  return Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, next))
}

export function applyOffset(n: number, offset: number): number {
  return Math.max(0, Math.min(100, n + offset))
}
