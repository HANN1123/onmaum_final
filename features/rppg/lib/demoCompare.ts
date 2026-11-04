// 시연용 워치 vs rPPG 비교(순수 함수). 상용 rPPG 앱처럼 "가만히 30초" 측정만 비교하고,
// 움직임·약한 신호일 때는 숫자를 보여 주지 않는다(틀린 숫자를 보여 주는 것보다 낫다).

import { MOTION_LIMIT, type TrackedHeartRate } from './hrEstimator'

/** 얼굴 상자 흔들림이 이 비율(얼굴 너비 대비)을 넘으면 움직임으로 본다. 엔진 게이트와 같은 값 */
export const DEMO_MOTION_LIMIT = MOTION_LIMIT
/** 표시 SNR 하한(dB). 엔진 게이트와 같은 잠정값 */
export const DEMO_MIN_SNR_DB = 0
/** 화면 숫자는 최근 이 시간의 유효 값 중앙값으로 다듬는다(워치도 몇 초를 평균해 보여 준다) */
export const DEMO_SMOOTH_MS = 5_000
/** 30초 측정 */
export const DEMO_MEASURE_MS = 30_000
/** 워치와 이만큼 안이면 일치로 센다 */
export const DEMO_MATCH_BPM = 5

export type DemoState = 'waiting' | 'motion' | 'weak' | 'ok'

export function demoState(est: TrackedHeartRate | null, minSnrDb: number = DEMO_MIN_SNR_DB): DemoState {
  if (!est) return 'waiting'
  if (est.motion !== null && est.motion > DEMO_MOTION_LIMIT) return 'motion'
  if (!(est.snrDb >= minSnrDb)) return 'weak'
  return 'ok'
}

export const DEMO_STATE_TEXT: Record<DemoState, string> = {
  waiting: '신호 모으는 중 · 가만히 화면을 봐 주세요',
  motion: '움직임 감지 · 잠시 멈춰 주세요',
  weak: '신호 약함 · 얼굴을 밝게, 화면 가운데로',
  ok: '측정 중',
}

export interface DemoPoint {
  t: number
  bpm: number
}

/** 최근 spanMs 안 값들의 중앙값. 없으면 null */
export function recentMedian(points: readonly DemoPoint[], now: number, spanMs: number = DEMO_SMOOTH_MS): number | null {
  const vals = points.filter((p) => p.t > now - spanMs && p.t <= now).map((p) => p.bpm).sort((a, b) => a - b)
  if (vals.length === 0) return null
  const mid = vals.length >> 1
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
}

export interface DemoPair {
  t: number
  watch: number | null
  rppg: number | null
}

/** 30초 측정 진행. 1초 칸을 경과 시간으로 채운다(타이머가 밀려 빠진 칸은 null 로 남아 분모에 들어간다) */
export interface DemoRun {
  start: number
  slots: (DemoPair | null)[]
}

export const DEMO_SLOTS = DEMO_MEASURE_MS / 1000

export function startDemoRun(start: number): DemoRun {
  return { start, slots: Array.from({ length: DEMO_SLOTS }, () => null) }
}

/**
 * 지금 값을 경과 시간에 맞는 칸에 넣는다. 칸 끝을 넘긴 늦은 값은 그 칸에 넣지 않는다(지난 칸을 최신 값으로 채우지 않음).
 * 30초가 지났으면 true 를 돌려준다.
 */
export function recordDemo(run: DemoRun, now: number, watch: number | null, rppg: number | null): boolean {
  const elapsed = now - run.start
  if (elapsed < 0) return false
  const i = Math.floor(elapsed / 1000)
  if (i < DEMO_SLOTS && run.slots[i] === null) run.slots[i] = { t: now, watch, rppg }
  return elapsed >= DEMO_MEASURE_MS
}

export interface DemoResult {
  /** 1초마다 남긴 칸 수 */
  seconds: number
  /** 워치·rPPG 둘 다 있던 칸 수 */
  paired: number
  watchMean: number | null
  rppgMean: number | null
  /** 짝지은 칸의 평균 절대 차이 */
  meanAbsDiff: number | null
  /** 짝지은 칸 중 차이가 DEMO_MATCH_BPM 이하인 비율 */
  matchRate: number | null
  /** rPPG 숫자가 나온 칸의 비율(움직임·약한 신호로 숨긴 칸은 빠진다) */
  coverage: number
}

/** 빈 칸(null)은 rPPG·워치 모두 없는 칸으로 센다 */
export function summarizeDemo(slots: readonly (DemoPair | null)[]): DemoResult {
  const pairs = slots.map((p, i) => p ?? { t: i, watch: null, rppg: null })
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null)
  const both = pairs.filter((p): p is DemoPair & { watch: number; rppg: number } => p.watch !== null && p.rppg !== null)
  const diffs = both.map((p) => Math.abs(p.rppg - p.watch))
  return {
    seconds: pairs.length,
    paired: both.length,
    watchMean: mean(pairs.flatMap((p) => (p.watch === null ? [] : [p.watch]))),
    rppgMean: mean(pairs.flatMap((p) => (p.rppg === null ? [] : [p.rppg]))),
    meanAbsDiff: mean(diffs),
    matchRate: both.length ? diffs.filter((d) => d <= DEMO_MATCH_BPM).length / both.length : null,
    coverage: pairs.length ? pairs.filter((p) => p.rppg !== null).length / pairs.length : 0,
  }
}
