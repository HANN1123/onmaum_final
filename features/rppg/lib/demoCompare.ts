// 시연용 워치 vs rPPG 비교(순수 함수). 상용 rPPG 앱처럼 "가만히 30초" 측정만 비교하고,
// 움직임·약한 신호일 때는 숫자를 보여 주지 않는다(틀린 숫자를 보여 주는 것보다 낫다).

import { MOTION_LIMIT, type TrackedHeartRate } from './hrEstimator'
import { SETTLE_MS } from '../engine/rppgGate'

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

/** 시작·초기화 뒤 첫 추정부터 엔진과 같은 시간 동안 표시와 집계를 보류한다 */
export function settledDemoState(est: TrackedHeartRate | null, now: number, firstEstimateAt: number | null): DemoState {
  if (firstEstimateAt === null || now - firstEstimateAt < SETTLE_MS) return 'waiting'
  return demoState(est)
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

/**
 * 워치 지연(초). 2026-11-04 실측 1회(5.8분, 심박 94~98)에서 rPPG(t)와 워치(t+6초)를 비교할 때 차이가 가장 작았다
 * (같은 시각 2.3 → 1.1 BPM). 워치는 심박을 몇 초 평균해 보내므로 늦게 바뀐다. 심박이 변하는 기록으로 다시 확인할 잠정값이다
 */
export const WATCH_LAG_S = 6

/**
 * 30초 측정 진행. 1초 칸을 경과 시간으로 채운다(타이머가 밀려 빠진 칸은 null 로 남아 분모에 들어간다).
 * 워치 지연 보정용으로 워치 값은 WATCH_LAG_S 초 더 받는다(lagWatch[i + WATCH_LAG_S] 를 rPPG 칸 i 와 비교).
 */
export interface DemoRun {
  start: number
  slots: (DemoPair | null)[]
  lagWatch: (number | null)[]
}

export const DEMO_SLOTS = DEMO_MEASURE_MS / 1000

export function startDemoRun(start: number): DemoRun {
  return {
    start,
    slots: Array.from({ length: DEMO_SLOTS }, () => null),
    lagWatch: Array.from({ length: DEMO_SLOTS + WATCH_LAG_S }, () => null),
  }
}

/** 측정 전체 길이(ms): rPPG 30초 + 워치 지연 보정용 추가 시간 */
export const DEMO_TOTAL_MS = (DEMO_SLOTS + WATCH_LAG_S) * 1000

/**
 * 지금 값을 경과 시간에 맞는 칸에 넣는다. 칸 끝을 넘긴 늦은 값은 그 칸에 넣지 않는다(지난 칸을 최신 값으로 채우지 않음).
 * rPPG 는 처음 30초만, 워치는 지연 보정용으로 WATCH_LAG_S 초 더 받는다. 다 받았으면 true.
 */
export function recordDemo(run: DemoRun, now: number, watch: number | null, rppg: number | null): boolean {
  const elapsed = now - run.start
  if (elapsed < 0) return false
  const i = Math.floor(elapsed / 1000)
  if (i < DEMO_SLOTS && run.slots[i] === null) run.slots[i] = { t: now, watch, rppg }
  if (i < run.lagWatch.length && run.lagWatch[i] === null) run.lagWatch[i] = watch
  return elapsed >= DEMO_TOTAL_MS
}

export interface DemoResult {
  /** 1초마다 남긴 칸 수 */
  seconds: number
  /** 워치·rPPG 둘 다 있던 칸 수 */
  paired: number
  watchMean: number | null
  rppgMean: number | null
  /** 짝지은 칸의 평균 절대 차이(같은 시각) */
  meanAbsDiff: number | null
  /** 짝지은 칸 중 차이가 DEMO_MATCH_BPM 이하인 비율 */
  matchRate: number | null
  /** rPPG 숫자가 나온 칸의 비율(움직임·약한 신호로 숨긴 칸은 빠진다) */
  coverage: number
  /** 워치 지연 보정(rPPG 칸 i ↔ 워치 칸 i + WATCH_LAG_S) 결과. 보정용 워치 값이 없으면 null */
  lag: { seconds: number; paired: number; meanAbsDiff: number | null; matchRate: number | null } | null
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null)

function compare(pairs: { watch: number | null; rppg: number | null }[]) {
  const both = pairs.filter((p): p is { watch: number; rppg: number } => p.watch !== null && p.rppg !== null)
  const diffs = both.map((p) => Math.abs(p.rppg - p.watch))
  return {
    paired: both.length,
    meanAbsDiff: mean(diffs),
    matchRate: both.length ? diffs.filter((d) => d <= DEMO_MATCH_BPM).length / both.length : null,
  }
}

/** 빈 칸(null)은 rPPG·워치 모두 없는 칸으로 센다. lagWatch 를 주면 워치 지연 보정 결과도 낸다 */
export function summarizeDemo(slots: readonly (DemoPair | null)[], lagWatch?: readonly (number | null)[]): DemoResult {
  const pairs = slots.map((p, i) => p ?? { t: i, watch: null, rppg: null })
  const same = compare(pairs)
  const lag = lagWatch ? compare(pairs.map((p, i) => ({ rppg: p.rppg, watch: lagWatch[i + WATCH_LAG_S] ?? null }))) : null
  return {
    seconds: pairs.length,
    paired: same.paired,
    watchMean: mean(pairs.flatMap((p) => (p.watch === null ? [] : [p.watch]))),
    rppgMean: mean(pairs.flatMap((p) => (p.rppg === null ? [] : [p.rppg]))),
    meanAbsDiff: same.meanAbsDiff,
    matchRate: same.matchRate,
    coverage: pairs.length ? pairs.filter((p) => p.rppg !== null).length / pairs.length : 0,
    lag: lag ? { seconds: pairs.length, ...lag } : null,
  }
}

/** 저장해 두는 시연 결과 한 건 */
export interface DemoRecord extends DemoResult {
  /** 측정을 시작한 실제 시각(ISO) */
  startedAt: string
  /** 같은 실험실 측정(측정 시작~정지) 안에서의 시작 시각(초). 파형 저장 파일의 시각과 같은 기준 */
  startS: number
  /** 이 결과를 낼 때 쓴 워치 지연(초) */
  lagS: number
}

const n = (v: number | null | undefined, digits: number) => (v === null || v === undefined || !Number.isFinite(v) ? '' : v.toFixed(digits))

/** 회차별 CSV. 같은 시각 비교와 워치 지연 보정 비교를 함께 남긴다 */
export function demoRecordsToCsv(records: readonly DemoRecord[]): string {
  const head =
    'n,started_at,start_s,seconds,paired,coverage,watch_mean,rppg_mean,mean_abs_diff,match_rate_5bpm,lag_s,lag_paired,lag_mean_abs_diff,lag_match_rate_5bpm'
  const lines = records.map((r, i) =>
    [
      i + 1,
      r.startedAt,
      n(r.startS, 1),
      r.seconds,
      r.paired,
      n(r.coverage, 3),
      n(r.watchMean, 1),
      n(r.rppgMean, 1),
      n(r.meanAbsDiff, 2),
      n(r.matchRate, 3),
      r.lagS,
      r.lag?.paired ?? '',
      n(r.lag?.meanAbsDiff, 2),
      n(r.lag?.matchRate, 3),
    ].join(','),
  )
  return [head, ...lines].join('\n')
}

/** localStorage 에서 읽은 값을 검사한다. 형식이 맞지 않는 항목은 버린다 */
export function parseDemoRecords(raw: string): DemoRecord[] {
  try {
    const arr: unknown = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
    const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
    const count = (v: unknown): v is number => nonnegative(v) && Number.isInteger(v)
    const ratio = (v: unknown) => nonnegative(v) && v <= 1
    const nullable = (v: unknown, valid: (v: unknown) => boolean) => v === null || valid(v)
    const comparison = (v: Record<string, unknown>) =>
      count(v.seconds) && count(v.paired) && v.paired <= v.seconds &&
      nullable(v.meanAbsDiff, nonnegative) && nullable(v.matchRate, ratio)
    return arr.filter((r): r is DemoRecord =>
      object(r) && typeof r.startedAt === 'string' && Number.isFinite(Date.parse(r.startedAt)) &&
      nonnegative(r.startS) && nonnegative(r.lagS) && comparison(r) && ratio(r.coverage) &&
      nullable(r.watchMean, nonnegative) && nullable(r.rppgMean, nonnegative) &&
      (r.lag === null || (object(r.lag) && comparison(r.lag))),
    )
  } catch {
    return []
  }
}
