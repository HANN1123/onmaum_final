// 맥박 파형(BVP) → 심박 추정기(2026-11-04 튜닝). heartRateFromBvp(10초 창 단일 피크)를 다음처럼 보강한다.
//  1) 대역 통과(0.7~3Hz, 2차 버터워스 앞뒤 적용): 고개·조명의 느린 흔들림이 맥박 대역 아래 끝(42 BPM)으로 새는 것을 줄인다.
//  2) 여러 모델 결합(선택): 모델마다 스펙트럼을 합 1로 정규화해 더한다. 측정 화면 엔진은 ME-rPPG 하나만 넣는다
//     (FacePhys 를 더해도 평균 오차 차이가 작고 어두운 조건에서는 나빠졌다).
//  3) 움직임 마스크: 얼굴 상자(중심 x·y, 너비)가 얼굴 너비의 MOTION_MASK_RATIO 이상 흔들린 주파수는 맥박 후보에서 뺀다.
//     합성 끄덕임(66 BPM) 시험에서 두 모델 모두 66 BPM 으로 고정됐고, 마스크로 이 고정이 풀렸다.
//  4) 추적: 직전 추정 근처 피크를 가우시안(σ 9 BPM)으로 우선한다. 다른 피크의 SNR 이 3dB 이상 높으면 그쪽으로 넘어간다.
//  5) 움직임 크기(motion)를 함께 돌려줘서, 화면이 "움직임 감지"로 숫자를 숨길 수 있게 한다.
// 근거: MCD-rPPG(CC BY 4.0) 정면 웹캠 30명 × 휴식·운동 직후, 접촉식 PPG 정답과 비교한 오프라인 평가(PR 본문에 수치).

import {
  contiguousTail,
  MAX_SAMPLE_GAP_MS,
  MIN_INPUT_FPS,
  powerSpectrum,
  resampleUniform,
  spectrumPeak,
  type HeartRate,
  type Spectrum,
} from './rppg'

export interface BvpPoint {
  t: number
  v: number
}

export interface BoxSample {
  t: number
  /** 얼굴 상자 중심(px) */
  cx: number
  cy: number
  /** 얼굴 상자 너비(px) */
  w: number
}

export interface TrackedHeartRate extends HeartRate {
  /** 맥박 대역(0.7~3Hz)에서 얼굴 상자가 가장 크게 흔들린 진폭(얼굴 너비 대비 비율). 상자 기록이 없으면 null */
  motion: number | null
  /** 결합에 쓴 모델 수 */
  models: number
}

const FS = 30
const MIN_SECONDS = 6
const HR_MIN_HZ = 0.7
const HR_MAX_HZ = 3.0
export const TRACK_WINDOW_MS = 10_000
/** 이 비율 이상 흔들린 주파수는 맥박 후보에서 뺀다. 정지 얼굴은 0.2~0.6%, 합성 끄덕임은 약 4%였다 */
export const MOTION_MASK_RATIO = 0.015
/**
 * 이 비율보다 크게 흔들리면 숫자를 보여 주지 않는다(움직임 감지). 잠정값: 정지 얼굴 0.2~0.6%, 합성 흔들림 약 4%.
 * 실제 말하기·움직임 기록(실험실 파형 저장)으로 다시 정한다
 */
export const MOTION_LIMIT = 0.02
/** 마스크 폭(±칸, 1칸 = 1 BPM) */
const MOTION_MASK_BINS = 3
const PRIOR_SIGMA_BPM = 9
/** 추적 고착 방지: 자유 피크의 SNR 이 추적 피크보다 이만큼 높으면 자유 피크를 쓴다 */
const ESCAPE_DB = 3
/** 직전 추정이 이보다 오래되면 추적하지 않는다 */
const PRIOR_MAX_AGE_MS = 3_000

type Biquad = [number, number, number, number, number]

/** 2차 버터워스 biquad 계수 (RBJ). 고역('hp')·저역('lp') */
function biquad(type: 'hp' | 'lp', f0: number, fs: number): Biquad {
  const w = (2 * Math.PI * f0) / fs
  const c = Math.cos(w)
  const a = Math.sin(w) / (2 * Math.SQRT1_2)
  const a0 = 1 + a
  const b0 = type === 'hp' ? (1 + c) / 2 : (1 - c) / 2
  const b1 = type === 'hp' ? -(1 + c) : 1 - c
  return [b0 / a0, b1 / a0, b0 / a0, (-2 * c) / a0, (1 - a) / a0]
}

function runBiquad(x: number[], [b0, b1, b2, a1, a2]: Biquad): number[] {
  const y = new Array<number>(x.length)
  // 첫 값의 직류 응답으로 초기화해 시작 과도 응답을 줄인다
  const dc = (b0 + b1 + b2) / (1 + a1 + a2)
  let x1 = x[0]
  let x2 = x[0]
  let y1 = x[0] * dc
  let y2 = y1
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = v
    y[i] = v
  }
  return y
}

/** 영위상 대역 통과(0.7~3Hz). 앞으로 한 번, 뒤로 한 번 걸어 위상 지연을 없앤다 */
export function bandpass(x: number[], fs: number = FS, lo = HR_MIN_HZ, hi = HR_MAX_HZ): number[] {
  if (x.length < 3) return x.slice()
  const hp = biquad('hp', lo, fs)
  const lp = biquad('lp', hi, fs)
  const forward = runBiquad(runBiquad(x, hp), lp)
  return runBiquad(runBiquad(forward.reverse(), hp), lp).reverse()
}

/** 끝 시각 기준 최근 windowMs 의 연속 구간을 30Hz 로 맞춘다. 6초·10fps 미만이면 null */
function uniformWindow(points: readonly BvpPoint[], endT: number, windowMs: number): { x: number[]; start: number; end: number } | null {
  const inWin = points.filter((p) => p.t <= endT && p.t >= endT - windowMs)
  const tail = contiguousTail(inWin, MAX_SAMPLE_GAP_MS)
  if (tail.length < 2) return null
  const span = tail[tail.length - 1].t - tail[0].t
  if (span < MIN_SECONDS * 1000 || (tail.length - 1) / (span / 1000) < MIN_INPUT_FPS) return null
  const x = resampleUniform(tail.map((p) => ({ t: p.t, r: p.v, g: 0, b: 0 })), FS).map((c) => c[0])
  if (!x.every(Number.isFinite)) return null
  return { x, start: tail[0].t, end: tail[tail.length - 1].t }
}

function normalized(s: Spectrum): number[] {
  const sum = s.power.reduce((a, b) => a + b, 0)
  return s.power.map((p) => (sum > 0 ? p / sum : 0))
}

/**
 * 얼굴 상자 궤적의 주파수별 진폭(얼굴 너비 대비 비율). 세 궤적(중심 x·y, 너비) 중 큰 값.
 * 주파수 격자는 powerSpectrum 과 같다(0.7~4Hz, 1 BPM).
 */
export function motionAmplitude(boxes: readonly BoxSample[], fs: number = FS): number[] | null {
  if (boxes.length < 2) return null
  const span = boxes[boxes.length - 1].t - boxes[0].t
  if (span < MIN_SECONDS * 1000) return null
  const grid = resampleUniform(boxes.map((b) => ({ t: b.t, r: b.cx, g: b.cy, b: b.w })), fs)
  const n = grid.length
  const meanW = grid.reduce((s, g) => s + g[2], 0) / n
  if (!(meanW > 0)) return null
  let hannSum = 0
  for (let k = 0; k < n; k++) hannSum += 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1))
  const specs = [0, 1, 2].map((c) => powerSpectrum(grid.map((g) => g[c]), fs))
  return specs[0].power.map((_, i) => Math.max(...specs.map((s) => (2 * Math.sqrt(s.power[i])) / hannSum)) / meanW)
}

/** 움직임 진폭이 기준을 넘는 주파수 ±MOTION_MASK_BINS 칸을 지운다(완전히 0 이 아니라 2%로 줄인다) */
export function maskMotion(power: number[], motion: readonly number[], ratio: number = MOTION_MASK_RATIO): number[] {
  return power.map((p, i) => {
    for (let d = -MOTION_MASK_BINS; d <= MOTION_MASK_BINS; d++) {
      if ((motion[i + d] ?? 0) > ratio) return p * 0.02
    }
    return p
  })
}

export interface HrTracker {
  /**
   * 여러 모델의 BVP 버퍼와 얼굴 상자 기록으로 지금 심박을 추정한다. 쓸 수 있는 모델이 없으면 null.
   * 버퍼들의 마지막 시각 중 가장 이른 시각을 창 끝으로 써서 모든 모델이 같은 구간을 본다.
   */
  estimate(buffers: readonly (readonly BvpPoint[])[], boxes?: readonly BoxSample[]): TrackedHeartRate | null
  reset(): void
}

export function createHrTracker({ windowMs = TRACK_WINDOW_MS }: { windowMs?: number } = {}): HrTracker {
  let prev: { bpm: number; t: number } | null = null
  return {
    estimate(buffers, boxes) {
      const live = buffers.filter((b) => b.length >= 2)
      if (live.length === 0) return null
      const endT = Math.min(...live.map((b) => b[b.length - 1].t))
      const wins = live.map((b) => uniformWindow(b, endT, windowMs)).filter((w) => w !== null)
      if (wins.length === 0) return null
      const specs = wins.map((w) => powerSpectrum(bandpass(w.x), FS))
      const freqs = specs[0].freqs
      let power = freqs.map(() => 0)
      for (const s of specs) {
        const p = normalized(s)
        power = power.map((v, i) => v + p[i])
      }
      const start = Math.max(...wins.map((w) => w.start))
      const end = Math.min(...wins.map((w) => w.end))
      let motion: number | null = null
      if (boxes && boxes.length > 1) {
        const amp = motionAmplitude(boxes.filter((b) => b.t >= start && b.t <= end))
        if (amp) {
          motion = Math.max(0, ...amp.filter((_, i) => freqs[i] >= HR_MIN_HZ && freqs[i] <= HR_MAX_HZ + 1e-9))
          power = maskMotion(power, amp)
        }
      }
      const spec: Spectrum = { freqs, power }
      const free = spectrumPeak(spec)
      const usePrior = prev !== null && end - prev.t <= PRIOR_MAX_AGE_MS
      const tracked = usePrior ? spectrumPeak(spec, { priorBpm: prev!.bpm, priorSigmaBpm: PRIOR_SIGMA_BPM }) : free
      const pick = usePrior && free.snrDb > tracked.snrDb + ESCAPE_DB ? free : tracked
      if (!Number.isFinite(pick.bpm) || !Number.isFinite(pick.snrDb)) return null
      prev = { bpm: pick.bpm, t: end }
      return { bpm: pick.bpm, snrDb: pick.snrDb, windowStart: start, windowEnd: end, motion, models: wins.length }
    },
    reset() {
      prev = null
    },
  }
}
