import type { Emotion } from '../emotion/emotionAnalysis'

export interface MotionParams {
  breathPeriodMs: number // 호흡 주기
  breathAmp: number // 호흡 진폭(반경 비율)
  floatY: number // 수직 이동(음수=위로 부유, 양수=가라앉음)
  jitter: boolean // 떨림 — 설계상 항상 false (떨림·번개 금지)
}

const MOTION: Record<Emotion, MotionParams> = {
  calm: { breathPeriodMs: 5000, breathAmp: 0.04, floatY: 0, jitter: false },
  happy: { breathPeriodMs: 3200, breathAmp: 0.05, floatY: -0.05, jitter: false },
  sad: { breathPeriodMs: 6500, breathAmp: 0.02, floatY: 0.06, jitter: false },
  angry: { breathPeriodMs: 4000, breathAmp: 0.05, floatY: 0, jitter: false },
}

export function motionFor(dominant: Emotion): MotionParams {
  return MOTION[dominant]
}
