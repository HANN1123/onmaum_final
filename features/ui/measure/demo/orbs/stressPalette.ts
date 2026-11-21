import type { StressLevel } from '@/features/algorithm/baseline/baseline'
import { ORB_PALETTE, type OrbPalette } from './emotionPalette'

/**
 * 측정 화면 오브의 스트레스 단계별 색(2026-11-20 교수님 피드백: 오브는 감정이 아니라 스트레스 상태를 보인다).
 * 낮음은 기존 평온 색을 그대로 쓰고, 단계가 오를수록 연두 → 주황 → 빨강(기존 분노 색)으로 간다.
 */
export const STRESS_PALETTE: Record<StressLevel, OrbPalette> = {
  low: ORB_PALETTE.calm,
  typical: { base: [150, 214, 92], deep: [24, 74, 32], accent: [214, 246, 168] },
  high: { base: [255, 150, 48], deep: [112, 46, 8], accent: [255, 212, 150] },
  veryHigh: ORB_PALETTE.angry,
}

/**
 * 오브가 반짝이는(박동 띠가 훑고 지나가는) 빠르기, 1분당 횟수(2026-11-20 교수님 피드백 후 조정).
 * 측정한 맥박 파형을 그대로 따르면 간격이 들쭉날쭉해서, 단계마다 일정한 간격으로 반짝이게 한다.
 * 단계가 높을수록 자주 반짝인다(낮음 약 1.7초, 보통 1.2초, 높음 0.9초, 매우 높음 0.7초마다). 실제 심박이 아니다.
 */
export const STRESS_BEAT_PER_MIN: Record<StressLevel, number> = {
  low: 36,
  typical: 50,
  high: 66,
  veryHigh: 84,
}
