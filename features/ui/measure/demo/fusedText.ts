import { classifyStress, type BaselineState, type StressLevel } from '@/features/algorithm/baseline/baseline'
import { REF_WINDOW_SEC, type LiveFusedState } from '@/features/algorithm/stress/fusedStress'
import { levelShort } from './storedOverview'

/** 저장된 기준선을 아직 읽지 못했을 때 쓰는 절대 기준 */
const ABSOLUTE: BaselineState = { mode: 'absolute', baselineN: null }

/** 측정 화면 오브 아래 스트레스 단계 글(2026-11-20 교수님 피드백: 점수 없이 4단계 이름만) */
export const STRESS_LEVEL_TEXT: Record<StressLevel, string> = {
  low: '낮음',
  typical: '보통',
  high: '높음',
  veryHigh: '매우 높음',
}

/** 지금 스트레스 단계: 결합 점수 S 를 기존 4단계 판정(classifyStress, 개인 기준선)에 넣는다. 측정 전이거나 아직 점수가 없으면 null */
export function liveStressLevel(active: boolean, state: LiveFusedState | null, baseline: BaselineState | null): StressLevel | null {
  if (!active || state === null) return null
  return classifyStress(state.s, baseline ?? ABSOLUTE)
}

/** 오브 아래 글: 단계 이름, 없으면 측정 전·표정 수집 중 */
export function stressLevelText(active: boolean, level: StressLevel | null): string {
  if (!active) return '측정 전'
  return level === null ? '표정 수집 중' : STRESS_LEVEL_TEXT[level]
}

/**
 * 측정 화면의 "현재 상태"·"결합 근거" 행 문구.
 * 현재 상태: 결합 점수 S 를 기존 4단계 판정(classifyStress, 개인 기준선)에 넣은 결과.
 * 결합 근거: 최근 1분 표정 점수 N, 심박과 세션 기준 심박의 차이.
 * 심박 차이 앞에는 지금 대표 심박의 출처(워치·카메라)를 붙여 어느 값으로 결합했는지 보인다.
 */
export function fusedRows(
  active: boolean,
  state: LiveFusedState | null,
  baseline: BaselineState | null,
  source: 'watch' | 'rppg' | null = null,
): [string, string][] {
  if (!active) return [['현재 상태', '측정 전'], ['결합 근거', '—']]
  if (state === null) return [['현재 상태', '표정 수집 중'], ['결합 근거', '—']]
  const base = baseline ?? ABSOLUTE
  const level = levelShort(classifyStress(state.s, base), base)
  const face = `표정 ${Math.round(state.n)}`
  if (state.baseline === null) {
    return [['현재 상태', `${level} · 점수 ${Math.round(state.s)}`],
      ['결합 근거', `${face} · 심박 기준 측정 중(처음 ${REF_WINDOW_SEC / 60}분)`]]
  }
  if (state.hr === null) {
    return [['현재 상태', `${level} · 점수 ${Math.round(state.s)}`], ['결합 근거', `${face} · 심박 신호 부족`]]
  }
  const diff = Math.round(state.hr - state.baseline.mu)
  const origin = source === 'watch' ? '워치 ' : source === 'rppg' ? '카메라 ' : ''
  const heart = `${origin}심박 ${diff >= 0 ? '+' : ''}${diff} bpm(기준 ${Math.round(state.baseline.mu)})`
  return [['현재 상태', `${level} · 점수 ${Math.round(state.s)}`], ['결합 근거', `${face} · ${heart}`]]
}
