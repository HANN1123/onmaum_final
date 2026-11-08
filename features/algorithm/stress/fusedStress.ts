import { ANGRY_WEIGHT } from './riskCalculator'
import type { EmotionResult } from '../emotion/emotionAnalysis'

/**
 * 표정 + 심박 결합 스트레스 점수 (docs/architecture/STRESS_FUSION_RULE.md 3.2~3.4절의 식).
 *
 * - 표정 점수 N(0~100): 부정 표정(슬픔 + 화남×가중치) 확률의 평균. 기존 aggregateStress 와 같은 식이다.
 * - 심박 상승 점수 A(0~100): 기준 심박 대비 상승분. 불감대 δ 이내와 기준보다 낮은 심박은 0이다.
 * - 결합 점수 S = N + GAMMA × (A/100) × N × (100 − N) / 100
 *   부정 표정이 없으면(N = 0) 심박이 올라도 S = 0 이다(말하기·움직임만으로 점수가 오르지 않게).
 *   GAMMA ≤ 1 이면 S 는 100 을 넘지 않고, N 이 큰 구간에서도 100 에 몰리지 않는다.
 *
 * 설계 문서는 기준 심박을 과거 13일 기록으로 만들지만 심박은 아직 저장 계층에 없다(스키마 변경 필요).
 * 그래서 측정 화면에서는 같은 세션의 첫 2분 심박을 기준으로 쓰는 세션 단위 근사로 계산한다.
 * 모든 매개변수는 검증 전 잠정값이다.
 */

/** 불감대 δ (BPM): 이 이하의 상승은 측정 오차로 보고 0으로 둔다 */
export const HR_DEADBAND = 3
/** 기준 심박 흔들림 σ 의 하한 (BPM): 작은 차이가 크게 증폭되지 않게 한다 */
export const HR_SIGMA_FLOOR = 3
/** A = 100 이 되는 표준화 상승(σ 배수) */
export const Z_MAX = 3
/** 결합 강도. 0 이면 S = N (결합 끔) */
export const GAMMA = 0.5
/** 채택하는 심박 범위 (BPM) */
export const HR_MIN = 40
export const HR_MAX = 180
/** 세션 기준 심박을 만드는 구간: 측정 시작 후 처음 몇 초 */
export const REF_WINDOW_SEC = 120
/** 기준 심박을 만들기 위한 최소 유효 표본(초) 수 */
export const MIN_REF_SAMPLES = 60
/** 현재 값을 보는 최근 구간 (초) */
export const RECENT_WINDOW_SEC = 60
/** 최근 구간에서 심박·표정 값이 있어야 하는 최소 비율 */
export const MIN_COVERAGE = 0.5

export interface HeartBaseline {
  /** 기준 심박 중앙값 */
  mu: number
  /** 1.4826 × MAD, 하한 HR_SIGMA_FLOOR */
  sigma: number
}

/** 1초 표본. bpm·neg 가 없으면 null (심박이 안 잡히거나 얼굴을 못 찾은 초) */
export interface FusedSample {
  /** 측정 시작 후 경과 초 */
  t: number
  bpm: number | null
  /** 부정 표정 확률 0~1 (슬픔 + 화남×가중치) */
  neg: number | null
}

export interface LiveFusedState {
  /** 최근 구간 표정 점수 N (0~100) */
  n: number
  /** 최근 구간 심박 중앙값. 표본이 모자라면 null */
  hr: number | null
  /** 세션 기준 심박. 아직 첫 구간이 모이지 않았으면 null */
  baseline: HeartBaseline | null
  /** 심박 상승 점수 A (0~100). 심박이나 기준이 없으면 null */
  a: number | null
  /** 결합 점수 S (0~100). A 가 null 이면 N 과 같다 */
  s: number
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function validBpm(bpm: number | null): bpm is number {
  return bpm !== null && Number.isFinite(bpm) && bpm >= HR_MIN && bpm <= HR_MAX
}

/** 한 순간의 부정 표정 확률 (0~1). aggregateStress 의 부정 항과 같은 식 */
export function negativeShare(e: EmotionResult): number {
  return e.sad + e.angry * ANGRY_WEIGHT
}

/** 심박 표본으로 기준 심박(중앙값)과 흔들림(1.4826 × MAD, 하한 3 BPM)을 만든다. 표본이 없으면 null */
export function heartBaseline(bpms: number[]): HeartBaseline | null {
  const valid = bpms.filter(validBpm)
  if (valid.length === 0) return null
  const mu = median(valid)
  const mad = median(valid.map((b) => Math.abs(b - mu)))
  return { mu, sigma: Math.max(1.4826 * mad, HR_SIGMA_FLOOR) }
}

/** 심박 상승 점수 A = 100 × min(1, max(0, HR − μ − δ) / (Z_MAX × σ)). 입력이 없으면 null */
export function heartRiseScore(hr: number | null, baseline: HeartBaseline | null): number | null {
  if (hr === null || baseline === null) return null
  const excess = Math.max(0, hr - baseline.mu - HR_DEADBAND)
  return 100 * Math.min(1, excess / (Z_MAX * baseline.sigma))
}

/** 결합 점수 S = N + γ × (A/100) × N × (100 − N) / 100. A 가 null 이면 N 그대로 */
export function fusedScore(n: number, a: number | null, gamma: number = GAMMA): number {
  if (a === null) return n
  return n + gamma * (a / 100) * n * (100 - n) / 100
}

/**
 * 세션의 1초 표본으로 지금의 결합 상태를 계산한다.
 * - 기준 심박: 처음 REF_WINDOW_SEC 초의 유효 심박이 MIN_REF_SAMPLES 개 이상이고, 그 구간이 끝난 뒤부터 쓴다.
 * - 최근 구간(RECENT_WINDOW_SEC 초)에서 표정 값이 있는 초가 MIN_COVERAGE 미만이면 null.
 * - 최근 구간의 유효 심박이 MIN_COVERAGE 미만이면 hr = null (S = N).
 */
export function liveFusedState(samples: FusedSample[], nowT: number): LiveFusedState | null {
  const recent = samples.filter((p) => p.t > nowT - RECENT_WINDOW_SEC && p.t <= nowT)
  const span = Math.min(RECENT_WINDOW_SEC, Math.max(1, nowT))
  const negs = recent.map((p) => p.neg).filter((v): v is number => v !== null)
  if (negs.length === 0 || negs.length / span < MIN_COVERAGE) return null
  const n = (100 * negs.reduce((sum, v) => sum + v, 0)) / negs.length

  const refBpms = samples.filter((p) => p.t < REF_WINDOW_SEC).map((p) => p.bpm).filter(validBpm)
  const baseline = nowT >= REF_WINDOW_SEC && refBpms.length >= MIN_REF_SAMPLES ? heartBaseline(refBpms) : null

  const recentBpms = recent.map((p) => p.bpm).filter(validBpm)
  const hr = recentBpms.length / span >= MIN_COVERAGE ? median(recentBpms) : null
  const a = heartRiseScore(hr, baseline)
  return { n, hr, baseline, a, s: fusedScore(n, a) }
}
