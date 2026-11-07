import type { BoxSample } from './hrEstimator'
import { expandFaceBox, type FaceBox } from './meRppg'

/**
 * crop 칼만(q=0.01, r=0.5)의 정상상태 사후 오차는 P²+qP-qr=0의 양의 해다.
 * P=(-q+√(q²+4qr))/2, K=(P+q)/(P+q+r) ≈ 0.131774.
 * 30fps에서 α=K가 되도록 τ=-(1000/30)/ln(1-K) ≈ 235.898ms로 맞춘다.
 * crop은 기존 프레임별 칼만을 유지하고, 움직임 판정만 실제 경과 시간으로 평활한다.
 */
const Q = 1e-2
const R = 0.5
const P = (-Q + Math.sqrt(Q * Q + 4 * Q * R)) / 2
const K = (P + Q) / (P + Q + R)
export const MOTION_TAU_MS = -(1000 / 30) / Math.log1p(-K)

/** 원시 BlazeFace 상자를 받아 움직임 추정용 좌표를 만든다. t는 원본 프레임 시각(ms)이다. */
export function createMotionSmoother() {
  let previous: FaceBox | null = null
  let previousT: number | null = null
  return {
    update(raw: FaceBox, t: number): BoxSample {
      const alpha = previousT === null ? 1 : -Math.expm1(-Math.max(0, t - previousT) / MOTION_TAU_MS)
      const mix = (key: keyof FaceBox) => previous ? previous[key] + alpha * (raw[key] - previous[key]) : raw[key]
      previous = { originX: mix('originX'), originY: mix('originY'), width: mix('width'), height: mix('height') }
      previousT = t
      // 기존 움직임 좌표와 중심·너비 정의를 맞춘다. 이 상자는 모델 crop에는 쓰지 않는다.
      const box = expandFaceBox(previous)
      return { t, cx: box.originX + box.width / 2, cy: box.originY + box.height / 2, w: box.width }
    },
    reset() {
      previous = null
      previousT = null
    },
  }
}
