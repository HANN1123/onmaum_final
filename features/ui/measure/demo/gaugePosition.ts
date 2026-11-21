import {
  ABS_HIGH,
  ABS_LOW,
  ABS_TYPICAL,
  REL_HIGH,
  REL_LOW,
  REL_VERY_HIGH,
  type BaselineState,
  type StressLevel,
} from '@/features/algorithm/baseline/baseline'

/**
 * 결과 화면의 스트레스 게이지(낮음 | 보통 | 높음 | 매우 높음, 2026-11-20 교수님 피드백 E3).
 * 막대는 네 칸을 같은 너비로 나누고, ▲ 표시를 오늘 값이 놓인 자리에 둔다.
 * 어느 칸인지는 기존 판정(classifyStress)이 낸 단계를 그대로 따르고, 칸 안의 위치만 값으로 정한다.
 * 칸 경계는 classifyStress 의 기준(기준선이 있으면 기준선 대비 비율, 없으면 절대값)과 같다.
 * 새 판정 규칙은 만들지 않는다.
 */

export const GAUGE_LEVELS: readonly StressLevel[] = ['low', 'typical', 'high', 'veryHigh']

/** 칸 안에서 ▲가 칸 끝에 붙어 옆 칸처럼 보이지 않게 남기는 여백(칸 너비 비율) */
const EDGE = 0.08

/** 네 칸의 경계값 다섯 개. 마지막 칸의 끝은 화면용으로만 정한다 */
function bounds(baseline: BaselineState): number[] {
  if (baseline.mode === 'relative' && baseline.baselineN !== null && baseline.baselineN > 0) {
    const b = baseline.baselineN
    return [0, b * REL_LOW, b * REL_HIGH, b * REL_VERY_HIGH, b * REL_VERY_HIGH * 1.5]
  }
  return [0, ABS_LOW, ABS_TYPICAL, ABS_HIGH, 100]
}

/**
 * ▲ 의 가로 위치(0~1, 막대 왼쪽 끝이 0).
 * 단계(level)가 정한 칸 안에서 값의 위치를 비례로 잡고, 칸 밖으로 나가지 않게 한다.
 * (기준선 대비로는 높음이지만 절대 하한 미만이라 보통으로 판정된 경우처럼 값과 칸이 어긋나도 ▲는 판정 칸에 남는다)
 */
export function gaugePosition(value: number, level: StressLevel, baseline: BaselineState): number {
  const index = GAUGE_LEVELS.indexOf(level)
  const edges = bounds(baseline)
  const lo = edges[index]
  const hi = edges[index + 1]
  const within = hi > lo ? (value - lo) / (hi - lo) : 0.5
  const t = Math.min(1 - EDGE, Math.max(EDGE, within))
  return (index + t) / GAUGE_LEVELS.length
}
