import type { EmotionResult } from './emotionAnalysis'

/**
 * 프레임마다 읽은 감정 비율(normalizeExpressions 결과)을 지수이동평균(EMA)으로 다듬는다.
 * - 근거: 2026-10-31 팀 내부 10분 실측(1명, 정면, 밝은 조명)에서 face-api 출력에 EMA(α = 0.4)를 적용하면
 *   프레임 간 흔들림이 줄어 다른 표정 모델(enet_b0)보다 안정적이었다. 표정 모델 교체 대신 다듬기를 권장안으로 남겼다.
 * - 화면 표시(현재 감정·오브 색)에만 쓴다. 1분 집계 저장은 원래 값을 평균하므로 이 다듬기를 거치지 않는다.
 * - α 가 클수록 새 값을 빨리 따라간다. 250ms 주기에서 α = 0.4 이면 약 1초 안에 새 값의 90% 가까이 따라간다.
 */
export const EMOTION_EMA_ALPHA = 0.4

/** 이전 값이 없으면 새 값을 그대로 쓴다. 결과의 합은 입력 합(1)을 유지한다. */
export function smoothEmotion(prev: EmotionResult | null, next: EmotionResult, alpha: number = EMOTION_EMA_ALPHA): EmotionResult {
  if (!prev) return { ...next }
  const mix = (a: number, b: number) => a + alpha * (b - a)
  return {
    happy: mix(prev.happy, next.happy),
    calm: mix(prev.calm, next.calm),
    sad: mix(prev.sad, next.sad),
    angry: mix(prev.angry, next.angry),
  }
}
