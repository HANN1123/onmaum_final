// rPPG spike — 웹캠 피부색 미세 변화에서 심박을 추정하는 순수 함수 모음.
// 파이프라인: ROI 피부 평균 RGB → 균일 리샘플 → POS(Wang 2017) → 대역 스펙트럼 피크.

export interface RgbSample {
  t: number // ms
  r: number
  g: number
  b: number
}

export interface HeartRate {
  bpm: number
  snrDb: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 맥박 탐색 대역: 42~180 BPM */
const HR_MIN_HZ = 0.7
const HR_MAX_HZ = 3.0
/** SNR 계산 대역 상한 — 2차 고조파까지 포함 (de Haan & Jeanne 2013) */
const SNR_MAX_HZ = 4.0
/** 스펙트럼 격자 간격 = 1 BPM */
const STEP_HZ = 1 / 60
const POS_WINDOW_SEC = 1.6
const MIN_SECONDS = 6
const DEFAULT_FS = 30

/** 불규칙한 프레임 타임스탬프를 fs 간격의 균일 격자로 선형 보간한다. */
export function resampleUniform(samples: RgbSample[], fs: number): number[][] {
  if (samples.length < 2) return samples.map((s) => [s.r, s.g, s.b])
  const dt = 1000 / fs
  const t0 = samples[0].t
  const tEnd = samples[samples.length - 1].t
  const out: number[][] = []
  let j = 0
  for (let k = 0; ; k++) {
    const t = t0 + k * dt
    if (t > tEnd + 1e-6) break
    while (j < samples.length - 2 && samples[j + 1].t < t) j++
    const a = samples[j]
    const b = samples[j + 1]
    const span = b.t - a.t
    const u = span > 0 ? (t - a.t) / span : 0
    out.push([a.r + (b.r - a.r) * u, a.g + (b.g - a.g) * u, a.b + (b.b - a.b) * u])
  }
  return out
}

function std(xs: number[]): number {
  const m = xs.reduce((s, v) => s + v, 0) / xs.length
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length)
}

/**
 * POS (Plane-Orthogonal-to-Skin). 짧은 창마다 채널을 시간 평균으로 정규화한 뒤
 * 피부색 방향에 직교하는 평면으로 투영 — 밝기(모든 채널 동일 비율 변화)는 상쇄되고
 * 혈류에 의한 색 변화만 남는다. 창 결과를 overlap-add.
 */
export function pos(rgb: number[][], fs: number): number[] {
  const n = rgb.length
  const l = Math.ceil(POS_WINDOW_SEC * fs)
  const h = new Array<number>(n).fill(0)
  if (n < l) return h
  const s1 = new Array<number>(l)
  const s2 = new Array<number>(l)
  for (let m = 0; m + l <= n; m++) {
    let mr = 0
    let mg = 0
    let mb = 0
    for (let k = 0; k < l; k++) {
      mr += rgb[m + k][0]
      mg += rgb[m + k][1]
      mb += rgb[m + k][2]
    }
    mr /= l
    mg /= l
    mb /= l
    if (mr <= 0 || mg <= 0 || mb <= 0) continue
    for (let k = 0; k < l; k++) {
      const r = rgb[m + k][0] / mr
      const g = rgb[m + k][1] / mg
      const b = rgb[m + k][2] / mb
      s1[k] = g - b
      s2[k] = -2 * r + g + b
    }
    const sd2 = std(s2)
    const alpha = sd2 > 0 ? std(s1) / sd2 : 0
    let mean = 0
    for (let k = 0; k < l; k++) mean += s1[k] + alpha * s2[k]
    mean /= l
    for (let k = 0; k < l; k++) h[m + k] += s1[k] + alpha * s2[k] - mean
  }
  return h
}

function detrendLinear(x: number[]): number[] {
  const n = x.length
  const tMean = (n - 1) / 2
  const xMean = x.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let k = 0; k < n; k++) {
    num += (k - tMean) * (x[k] - xMean)
    den += (k - tMean) ** 2
  }
  const slope = den > 0 ? num / den : 0
  return x.map((v, k) => v - xMean - slope * (k - tMean))
}

/** Hann 창 + 1 BPM 격자 DFT로 맥박 대역의 피크와 SNR을 구한다. */
export function spectralPeak(x: number[], fs: number): HeartRate {
  const n = x.length
  const y = detrendLinear(x).map((v, k) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * k) / (n - 1))))

  const freqs: number[] = []
  const power: number[] = []
  for (let i = 0; ; i++) {
    const f = HR_MIN_HZ + i * STEP_HZ
    if (f > SNR_MAX_HZ + 1e-9) break
    const w = (2 * Math.PI * f) / fs
    let re = 0
    let im = 0
    for (let k = 0; k < n; k++) {
      re += y[k] * Math.cos(w * k)
      im -= y[k] * Math.sin(w * k)
    }
    freqs.push(f)
    power.push(re * re + im * im)
  }

  let peak = 0
  for (let i = 1; i < freqs.length && freqs[i] <= HR_MAX_HZ + 1e-9; i++) {
    if (power[i] > power[peak]) peak = i
  }
  let f0 = freqs[peak]
  if (peak > 0 && peak < freqs.length - 1) {
    const a = power[peak - 1]
    const b = power[peak]
    const c = power[peak + 1]
    const den = a - 2 * b + c
    if (den !== 0) f0 += (0.5 * (a - c) / den) * STEP_HZ
  }

  let sig = 0
  let noise = 0
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i]
    if (Math.abs(f - f0) <= 0.1 || Math.abs(f - 2 * f0) <= 0.2) sig += power[i]
    else noise += power[i]
  }
  const snrDb = noise > 0 && sig > 0 ? 10 * Math.log10(sig / noise) : -Infinity

  return { bpm: f0 * 60, snrDb }
}

/** 피부 평균 RGB 시계열(최소 6초)에서 심박을 추정한다. */
export function estimateHeartRate(samples: RgbSample[], fs: number = DEFAULT_FS): HeartRate | null {
  if (samples.length < 2) return null
  if (samples[samples.length - 1].t - samples[0].t < MIN_SECONDS * 1000) return null
  return spectralPeak(pos(resampleUniform(samples, fs), fs), fs)
}

const BVP_WINDOW_MS = 10_000

/** 딥러닝 모델(ME-rPPG 등)이 낸 맥박 파형에서 최근 10초로 심박을 추정한다. */
export function heartRateFromBvp(points: { t: number; v: number }[], fs: number = DEFAULT_FS): HeartRate | null {
  if (points.length < 2) return null
  const from = points[points.length - 1].t - BVP_WINDOW_MS
  const win = points.filter((p) => p.t >= from)
  if (win[win.length - 1].t - win[0].t < MIN_SECONDS * 1000) return null
  const x = resampleUniform(
    win.map((p) => ({ t: p.t, r: p.v, g: 0, b: 0 })),
    fs,
  ).map((c) => c[0])
  return spectralPeak(x, fs)
}

/**
 * RGBA 픽셀 중 피부색(YCbCr: Cr 133~173, Cb 77~127 — Chai & Ngan 1999)만 평균낸다.
 * 앞머리·배경이 ROI에 섞여도 맥박 신호가 희석되지 않게 한다.
 */
export function meanSkinRgb(
  data: Uint8ClampedArray,
): { r: number; g: number; b: number; skinRatio: number } | null {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  const total = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i]
    const G = data[i + 1]
    const B = data[i + 2]
    const cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B
    const cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B
    if (cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127) {
      r += R
      g += G
      b += B
      count++
    }
  }
  if (count === 0) return null
  return { r: r / count, g: g / count, b: b / count, skinRatio: count / total }
}

/**
 * face-api 68점 랜드마크 → 이마·양볼 ROI.
 * 이마: 안쪽 눈썹 폭, 눈썹 위 얼굴높이 5~25% (앞머리에 덜 가리는 아래쪽 이마).
 * 볼: 콧등 중간(눈 아래) ~ 코 밑(입 위), 턱선과 콧볼 사이 — 말할 때 움직이는 입·턱 제외.
 */
export function roiRects(pts: { x: number; y: number }[]): {
  forehead: Rect
  leftCheek: Rect
  rightCheek: Rect
} {
  let browTop = Infinity
  for (let i = 17; i <= 26; i++) browTop = Math.min(browTop, pts[i].y)
  const faceH = pts[8].y - browTop

  const forehead: Rect = {
    x: pts[19].x,
    y: browTop - 0.25 * faceH,
    w: pts[24].x - pts[19].x,
    h: 0.2 * faceH,
  }

  const top = pts[29].y
  const h = pts[33].y - top
  const lw = pts[31].x - pts[1].x
  const rw = pts[15].x - pts[35].x
  const leftCheek: Rect = { x: pts[1].x + 0.3 * lw, y: top, w: 0.6 * lw, h }
  const rightCheek: Rect = { x: pts[35].x + 0.1 * rw, y: top, w: 0.6 * rw, h }

  return { forehead, leftCheek, rightCheek }
}

// ── 실험 페이지용: 워치(정답) vs 앱 추정 오차 집계 ───────────────────────

export type Condition = 'quiet' | 'talk' | 'move'
export type RoiSet = 'forehead' | 'all' | 'me'

export interface PairRow {
  condition: Condition
  watch: number
  forehead: HeartRate | null
  all: HeartRate | null
  /** ME-rPPG(딥러닝) 추정 — 없으면 미측정 */
  me?: HeartRate | null
}

export interface ErrorSummary {
  n: number
  /** 추정값이 있는 행의 평균절대오차(BPM) */
  mae: number | null
  /** SNR ≥ 게이트인 행 비율 */
  coverage: number
  /** 게이트 통과 행만의 평균절대오차 */
  gatedMae: number | null
}

function meanOrNull(xs: number[]): number | null {
  return xs.length > 0 ? xs.reduce((s, v) => s + v, 0) / xs.length : null
}

export function summarizePairs(
  rows: PairRow[],
  gateDb: number,
): Record<Condition, Record<RoiSet, ErrorSummary>> {
  const summarize = (cond: Condition, roi: RoiSet): ErrorSummary => {
    const sub = rows.filter((r) => r.condition === cond)
    const errs: number[] = []
    const gatedErrs: number[] = []
    for (const r of sub) {
      const est = r[roi]
      if (!est) continue
      const err = Math.abs(est.bpm - r.watch)
      errs.push(err)
      if (est.snrDb >= gateDb) gatedErrs.push(err)
    }
    return {
      n: sub.length,
      mae: meanOrNull(errs),
      coverage: sub.length > 0 ? gatedErrs.length / sub.length : 0,
      gatedMae: meanOrNull(gatedErrs),
    }
  }
  const conds: Condition[] = ['quiet', 'talk', 'move']
  return Object.fromEntries(
    conds.map((c) => [
      c,
      { forehead: summarize(c, 'forehead'), all: summarize(c, 'all'), me: summarize(c, 'me') },
    ]),
  ) as Record<Condition, Record<RoiSet, ErrorSummary>>
}
