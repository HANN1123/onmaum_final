import type { HeartRate } from '../lib/rppg'
import { MOTION_LIMIT } from '../lib/hrEstimator'

/**
 * ME-rPPG 엔진의 상태와 품질 게이트(순수 함수). 화면은 이 결과만 보고 심박을 보여줄지 정한다.
 * 게이트 기준은 실험실(RppgLab)과 같다.
 * - 워밍업: 모델 출력 30개는 버린다.
 * - 신선도: 마지막 출력에 대응하는 원본 프레임 시각이 2초 이내여야 한다(응답 도착 시각이 아님).
 * - 연속성·밀도: heartRateFromBvp 가 공백 500ms 이하로 이어진 6초 이상, 평균 10fps 이상인 구간만 쓴다.
 * - SNR: minSnrDb 이상. 기본 0dB 는 잠정값이다(2026-10-31 1인 실측 기준, 검증된 최적값 아님).
 * - 안정화(2026-11-04): 엔진을 시작하거나 다시 시작한 뒤 첫 추정이 나오고 SETTLE_MS 동안은 보이지 않는다.
 *   10/31 실측에서 시작 직후 약 10초 동안 모델이 134~139 BPM(워치 81)을 냈고 그중 일부가 SNR 기준을 넘었다.
 *   같은 기록으로 비교하면 12초 보류 시 표시 비율 73% → 70%, MAE 4.04 → 2.40 BPM, 최대 오차 53 → 10 BPM.
 *   1명·2분 기록이므로 실측으로 다시 확인할 잠정값이다. 중앙값 다듬기는 같은 비교에서 효과가 없어(4.04 → 4.67) 넣지 않았다.
 * - 움직임(2026-11-04): 추정 창 동안 얼굴 상자가 맥박 대역에서 MOTION_LIMIT(얼굴 너비의 2%) 넘게 흔들리면 숫자를 숨긴다.
 *   합성 끄덕임(66 BPM) 시험에서 모델이 맥박 대신 끄덕임 주기를 내면서도 SNR 이 기준을 넘었다(SNR 로는 못 거른다).
 */

export type RppgStatus =
  /** 측정하지 않음 */
  | 'off'
  /** 모델·얼굴 검출기를 불러오는 중 */
  | 'loading'
  /** 얼굴을 찾지 못함 */
  | 'noFace'
  /** 출력이 쌓이는 중(워밍업, 6초 창 채우는 중, 입력이 끊겨 다시 쌓는 중) */
  | 'warming'
  /** 추정은 됐지만 신호 품질(SNR)이 기준 미달 */
  | 'lowSignal'
  /** 얼굴이 맥박 대역에서 크게 흔들림(말하기·움직임). 숫자를 숨긴다 */
  | 'motion'
  /** 기준을 넘은 심박 */
  | 'live'
  /** 모델·worker 오류 */
  | 'error'

export interface RppgReading {
  status: RppgStatus
  /** status 가 'live' 일 때만 값이 있다 */
  bpm: number | null
  /** 마지막 추정의 SNR(dB). 추정이 없으면 null */
  snrDb: number | null
  /** 마지막 출력에 대응하는 원본 프레임이 지금으로부터 얼마나 지났는지(ms). 출력이 없으면 null */
  ageMs: number | null
}

export const ME_WARMUP = 30
export const STALE_MS = 2_000
/** 잠정 SNR 기준(dB). 작업 지시서 5.3 */
export const DEFAULT_MIN_SNR_DB = 0
/** 첫 추정 뒤 표시를 보류하는 시간(ms). 잠정값 */
export const SETTLE_MS = 12_000

export const OFF_READING: RppgReading = { status: 'off', bpm: null, snrDb: null, ageMs: null }

export interface GateInput {
  /** 모델·검출기 준비 여부. 'error' 면 오류 */
  engine: 'loading' | 'ready' | 'error'
  /** 마지막 프레임에서 얼굴을 찾았는지 */
  face: boolean
  /** 이번 측정(또는 마지막 초기화) 이후 받은 모델 출력 수 */
  outputs: number
  /** 마지막 출력에 대응하는 원본 프레임 시각(ms). 없으면 null */
  lastFrameT: number | null
  /** 지금 시각(ms, 프레임 시각과 같은 시계) */
  now: number
  /** heartRateFromBvp 결과. 연속성·밀도 기준을 못 넘으면 null */
  estimate: HeartRate | null
  /** 이번 시작(또는 마지막 초기화) 뒤 첫 추정이 나온 시각(ms, now 와 같은 시계). 아직 없으면 null */
  firstEstimateAt: number | null
  minSnrDb: number
  /** 추정 창의 얼굴 흔들림(얼굴 너비 대비). 없으면 판단하지 않는다 */
  motion?: number | null
}

export function gateReading(input: GateInput): RppgReading {
  const { engine, face, outputs, lastFrameT, now, estimate, firstEstimateAt, minSnrDb, motion = null } = input
  const ageMs = lastFrameT === null ? null : Math.max(0, now - lastFrameT)
  const snrDb = estimate ? estimate.snrDb : null
  if (engine === 'error') return { status: 'error', bpm: null, snrDb: null, ageMs }
  if (engine === 'loading') return { status: 'loading', bpm: null, snrDb: null, ageMs }
  if (!face) return { status: 'noFace', bpm: null, snrDb, ageMs }
  const fresh = ageMs !== null && ageMs < STALE_MS
  if (outputs <= ME_WARMUP || !fresh || !estimate) return { status: 'warming', bpm: null, snrDb, ageMs }
  if (firstEstimateAt === null || now - firstEstimateAt < SETTLE_MS) return { status: 'warming', bpm: null, snrDb, ageMs }
  if (motion !== null && motion > MOTION_LIMIT) return { status: 'motion', bpm: null, snrDb, ageMs }
  if (!(estimate.snrDb >= minSnrDb)) return { status: 'lowSignal', bpm: null, snrDb, ageMs }
  return { status: 'live', bpm: estimate.bpm, snrDb, ageMs }
}

/** 화면에 쓰는 짧은 상태 글 */
export const RPPG_STATUS_TEXT: Record<RppgStatus, string> = {
  off: '대기',
  loading: '준비 중',
  noFace: '얼굴 찾는 중',
  warming: '신호 모으는 중',
  lowSignal: '신호 약함',
  motion: '움직임 감지',
  live: '측정 중',
  error: '오류',
}

/**
 * 맥박 파형의 최근 값을 0~1 로 맞춘다(시각화 전용). 최근 spanMs 안의 최소·최대로 정규화한다.
 * BVP 는 부호와 크기가 일정하지 않으므로 이 값을 심박 수치로 쓰지 않는다.
 */
export function pulseLevel(buffer: readonly { t: number; v: number }[], spanMs = 3_000): number {
  if (buffer.length < 2) return 0
  const last = buffer[buffer.length - 1]
  let lo = Infinity
  let hi = -Infinity
  for (let i = buffer.length - 1; i >= 0 && buffer[i].t >= last.t - spanMs; i--) {
    const v = buffer[i].v
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  if (!(hi > lo)) return 0
  return (last.v - lo) / (hi - lo)
}
