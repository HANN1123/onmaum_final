import type { FaceBox } from './useFaceTrack'

/**
 * 얼굴 추적 표시를 다듬는 순수 함수.
 * - 상자: 검출이 250ms 마다 들어와 상자가 툭툭 끊겨 움직이므로 EMA 로 부드럽게 잇는다.
 *   크게 움직였을 때(상자 폭의 절반 넘게)는 따라가는 데 늦지 않도록 바로 새 위치로 옮긴다.
 * - 놓침: 검출이 한두 번 빠졌다고 바로 "얼굴 없음"으로 바꾸지 않는다. MISS_LIMIT 번 연속 놓쳐야 없음으로 본다.
 *   250ms 주기에서 3번이면 약 0.75초다.
 */
export const BOX_EMA_ALPHA = 0.5
export const MISS_LIMIT = 3

export function smoothBox(prev: FaceBox | null, next: FaceBox, alpha: number = BOX_EMA_ALPHA): FaceBox {
  if (!prev) return { ...next }
  const jump = Math.hypot(next.x + next.w / 2 - (prev.x + prev.w / 2), next.y + next.h / 2 - (prev.y + prev.h / 2))
  if (jump > prev.w / 2) return { ...next }
  const mix = (a: number, b: number) => a + alpha * (b - a)
  return { x: mix(prev.x, next.x), y: mix(prev.y, next.y), w: mix(prev.w, next.w), h: mix(prev.h, next.h) }
}

export interface Presence {
  /** 화면에 얼굴이 있다고 보여 주는지 */
  present: boolean
  /** 연속으로 놓친 횟수 */
  misses: number
}

export const NO_PRESENCE: Presence = { present: false, misses: 0 }

/** 이번 검출 결과(found)로 얼굴 있음 여부를 갱신한다. 찾으면 바로 있음, 놓치면 MISS_LIMIT 번 연속일 때 없음. */
export function nextPresence(prev: Presence, found: boolean, limit: number = MISS_LIMIT): Presence {
  if (found) return { present: true, misses: 0 }
  const misses = prev.misses + 1
  return { present: prev.present && misses < limit, misses }
}
