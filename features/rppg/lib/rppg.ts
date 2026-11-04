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
  /** 추정에 실제로 쓴 창의 시작·끝 (ms). 기준값과 같은 구간인지 판단할 때 쓴다 */
  windowStart?: number
  windowEnd?: number
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
/** 이 간격을 넘는 샘플 공백은 끊긴 구간으로 보고 이어 붙이지 않는다 */
export const MAX_SAMPLE_GAP_MS = 500
/** 추정 창의 최소 입력 밀도. 이보다 드물면 맥박 대역을 믿을 수 없다 */
export const MIN_INPUT_FPS = 10

/** 끝에서부터 공백 없이 이어진 구간만 돌려준다 */
export function contiguousTail<T extends { t: number }>(samples: T[], maxGapMs: number = MAX_SAMPLE_GAP_MS): T[] {
  let start = samples.length - 1
  while (start > 0 && samples[start].t - samples[start - 1].t <= maxGapMs) start--
  return samples.slice(Math.max(start, 0))
}

function usableWindow<T extends { t: number }>(samples: T[]): T[] | null {
  const tail = contiguousTail(samples)
  if (tail.length < 2) return null
  const spanMs = tail[tail.length - 1].t - tail[0].t
  if (spanMs < MIN_SECONDS * 1000) return null
  if ((tail.length - 1) / (spanMs / 1000) < MIN_INPUT_FPS) return null
  return tail
}

/** 무신호(SNR 비유한)는 심박으로 세지 않고, 유효한 결과에는 실제 창을 붙인다 */
function withWindow(est: HeartRate, win: { t: number }[]): HeartRate | null {
  if (!Number.isFinite(est.bpm) || !Number.isFinite(est.snrDb)) return null
  return { ...est, windowStart: win[0].t, windowEnd: win[win.length - 1].t }
}

export interface FrameClock {
  /** 프레임 시각. 출처가 없거나 시각이 역행하면 null이고 그 프레임은 버린다 */
  next(now: number, captureTime: number | undefined): number | null
  source(): 'capture' | 'display' | null
}

/** 시각 출처를 첫 프레임에서 고정한다. 한 세션에서 출처가 섞이면 버퍼 시간축이 깨진다 */
export function createFrameClock(): FrameClock {
  let source: 'capture' | 'display' | null = null
  let last = -Infinity
  return {
    next(now, captureTime) {
      source ??= captureTime === undefined ? 'display' : 'capture'
      const t = source === 'capture' ? captureTime : now
      if (t === undefined || t <= last) return null
      last = t
      return t
    },
    source: () => source,
  }
}

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

/** 1 BPM 격자 파워 스펙트럼(0.7~4Hz). freqs 는 Hz */
export interface Spectrum {
  freqs: number[]
  power: number[]
}

/** Hann 창 + 1 BPM 격자 DFT 파워 스펙트럼. 맥박 대역(0.7~3Hz)과 SNR 계산용 2차 고조파(~4Hz)까지 */
export function powerSpectrum(x: number[], fs: number): Spectrum {
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
  return { freqs, power }
}

export interface PeakOptions {
  /** 직전 심박(BPM). 주면 그 근처 피크를 가우시안 가중으로 우선한다 */
  priorBpm?: number | null
  /** 가우시안 폭(BPM) */
  priorSigmaBpm?: number
}

/**
 * 스펙트럼에서 맥박 피크와 SNR을 구한다. SNR = (피크 ±0.1Hz + 2차 고조파 ±0.2Hz) / 나머지(0.7~4Hz).
 * priorBpm 이 있으면 피크 선택에만 가중을 쓰고, 보간·SNR 은 원래 파워로 계산한다.
 */
export function spectrumPeak({ freqs, power }: Spectrum, opts: PeakOptions = {}): HeartRate {
  const prior = opts.priorBpm ?? null
  const sigmaHz = (opts.priorSigmaBpm ?? 9) / 60
  const weight = (f: number) => (prior === null ? 1 : Math.exp(-((f - prior / 60) ** 2) / (2 * sigmaHz ** 2)))
  let peak = 0
  for (let i = 1; i < freqs.length && freqs[i] <= HR_MAX_HZ + 1e-9; i++) {
    if (power[i] * weight(freqs[i]) > power[peak] * weight(freqs[peak])) peak = i
  }
  let f0 = freqs[peak]
  if (peak > 0 && peak < freqs.length - 1) {
    const a = power[peak - 1]
    const b = power[peak]
    const c = power[peak + 1]
    const den = a - 2 * b + c
    if (den !== 0) {
      const d = (0.5 * (a - c)) / den
      if (Math.abs(d) <= 1) f0 += d * STEP_HZ
    }
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

/** Hann 창 + 1 BPM 격자 DFT로 맥박 대역의 피크와 SNR을 구한다. */
export function spectralPeak(x: number[], fs: number): HeartRate {
  return spectrumPeak(powerSpectrum(x, fs))
}

/** 피부 평균 RGB 시계열(최소 6초)에서 심박을 추정한다. */
export function estimateHeartRate(samples: RgbSample[], fs: number = DEFAULT_FS): HeartRate | null {
  const win = usableWindow(samples)
  if (!win) return null
  return withWindow(spectralPeak(pos(resampleUniform(win, fs), fs), fs), win)
}

const BVP_WINDOW_MS = 10_000

/** 딥러닝 모델(ME-rPPG 등)이 낸 맥박 파형에서 최근 10초로 심박을 추정한다. */
export function heartRateFromBvp(points: { t: number; v: number }[], fs: number = DEFAULT_FS): HeartRate | null {
  if (points.length < 2) return null
  const from = points[points.length - 1].t - BVP_WINDOW_MS
  const win = usableWindow(points.filter((p) => p.t >= from))
  if (!win) return null
  const x = resampleUniform(
    win.map((p) => ({ t: p.t, r: p.v, g: 0, b: 0 })),
    fs,
  ).map((c) => c[0])
  return withWindow(spectralPeak(x, fs), win)
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

export type RefSource = 'ble' | 'manual'

/** 기준 기기에서 받은 값. t는 PC가 받은 시각이다 */
export interface ReferenceSample {
  t: number
  bpm: number
  contact: 'unsupported' | 'good' | 'poor'
}

export interface ReferenceValue {
  bpm: number
  /** 평균에 쓴 알림 수. 독립 측정 횟수가 아니다 */
  n: number
  /** 마지막 알림을 받고 지난 초. 워치 측정값의 실제 나이가 아니다 */
  ageS: number
}

/**
 * 최근 구간의 기준 심박 평균. 받은 시각 기준 대리값이고 워치 측정 시각과 맞춘 값이 아니다.
 * 알림이 드물거나 구간을 고르게 덮지 못하면 null이다.
 */
export function referenceBpm(
  samples: ReferenceSample[],
  atMs: number,
  windowMs: number = 10_000,
  staleMs: number = 8_000,
): ReferenceValue | null {
  const from = atMs - windowMs
  const win = samples.filter((s) => s.t >= from && s.t <= atMs && s.contact !== 'poor')
  if (win.length < 2) return null
  const last = win[win.length - 1]
  if (atMs - last.t > staleMs || win[0].t - from > staleMs) return null
  for (let i = 1; i < win.length; i++) {
    if (win[i].t - win[i - 1].t > staleMs) return null
  }
  return {
    bpm: win.reduce((sum, s) => sum + s.bpm, 0) / win.length,
    n: win.length,
    ageS: (atMs - last.t) / 1000,
  }
}

export interface PairRow {
  condition: Condition
  /** 기준 BPM. 자동 평가에서 기준값을 얻지 못한 슬롯은 null */
  watch: number | null
  forehead: HeartRate | null
  all: HeartRate | null
  /** ME-rPPG(딥러닝) 추정 — 없으면 미측정 */
  me?: HeartRate | null
}

export type LabRow = PairRow & {
  t: number
  fps: number
  runId?: string
  source?: RefSource
  /** 자동 평가의 슬롯 번호. 수동 입력은 null */
  slot?: number | null
  conditionSec?: number | null
  /** 슬롯이 비교되지 못한 이유 */
  reason?: string | null
  refAgeS?: number | null
  refN?: number | null
  /** 평가 전에 고정한 품질 게이트 */
  gateDb?: number
  /** 이 행의 추정 창 시각을 측정 시작 기준으로 바꿀 때 쓰는 시작 시각 */
  originMs?: number
  meOutFps?: number
  meDropped?: number
}

function parseEstimate(v: unknown): HeartRate | null {
  if (typeof v !== 'object' || v === null) return null
  const { bpm, snrDb, windowStart, windowEnd } = v as Record<string, unknown>
  if (typeof bpm !== 'number' || !Number.isFinite(bpm)) return null
  // JSON에서 -Infinity는 null이 된다. 품질을 모르는 결과는 게이트를 통과시키지 않는다
  if (typeof snrDb !== 'number' || !Number.isFinite(snrDb)) return null
  return {
    bpm,
    snrDb,
    ...(typeof windowStart === 'number' ? { windowStart } : {}),
    ...(typeof windowEnd === 'number' ? { windowEnd } : {}),
  }
}

const CONDITIONS: Condition[] = ['quiet', 'talk', 'move']

/** localStorage에서 읽은 실험 기록을 검증한다. 구조가 깨진 행은 버린다 */
export function parseLabRows(raw: string): LabRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((v): LabRow[] => {
    if (typeof v !== 'object' || v === null) return []
    const r = v as Record<string, unknown>
    if (!CONDITIONS.includes(r.condition as Condition)) return []
    const watch = r.watch === null ? null : r.watch
    if (watch !== null && (typeof watch !== 'number' || !Number.isFinite(watch))) return []
    if (typeof r.t !== 'number' || typeof r.fps !== 'number') return []
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
    return [
      {
        ...(typeof r.runId === 'string' ? { runId: r.runId } : {}),
        ...(r.source === 'ble' || r.source === 'manual' ? { source: r.source } : {}),
        slot: num(r.slot),
        conditionSec: num(r.conditionSec),
        reason: typeof r.reason === 'string' ? r.reason : null,
        refAgeS: num(r.refAgeS),
        refN: num(r.refN),
        ...(num(r.gateDb) !== null ? { gateDb: num(r.gateDb) as number } : {}),
        ...(num(r.originMs) !== null ? { originMs: num(r.originMs) as number } : {}),
        ...(num(r.meOutFps) !== null ? { meOutFps: num(r.meOutFps) as number } : {}),
        ...(num(r.meDropped) !== null ? { meDropped: num(r.meDropped) as number } : {}),
        t: r.t,
        fps: r.fps,
        condition: r.condition as Condition,
        watch,
        forehead: parseEstimate(r.forehead),
        all: parseEstimate(r.all),
        me: parseEstimate(r.me),
      },
    ]
  })
}

/** 시험 전에 정한 내부 목표. 이 장비·이 참여자에서 워치와의 일치도를 보는 기준이다 */
const TARGETS: Record<Condition, { mae: number; coverage: number } | null> = {
  quiet: { mae: 5, coverage: 0.7 },
  talk: { mae: 8, coverage: 0.5 },
  move: null,
}
/** 비교 가능한 슬롯이 이 비율보다 적으면 합격·불합격을 말하지 않는다 */
const MIN_COMPARABLE_RATE = 0.5

export type Verdict = 'pass' | 'fail' | 'undecided' | 'exploratory'

export interface ErrorSummary {
  /** 예정된 슬롯 수. 실패한 슬롯도 포함한다 */
  n: number
  /** 추정값과 기준값이 모두 있는 쌍의 평균절대오차(BPM) */
  mae: number | null
  /** SNR ≥ 게이트이고 비교 가능한 슬롯 비율 */
  coverage: number
  /** 게이트 통과 쌍만의 평균절대오차 */
  gatedMae: number | null
  /** 추정값이 있는 슬롯 비율 */
  rppgRate: number
  /** 기준값이 있는 슬롯 비율 */
  refRate: number
  /** 추정값과 기준값이 모두 있는 슬롯 비율 */
  comparableRate: number
  verdict: Verdict
}

function verdictOf(cond: Condition, s: Omit<ErrorSummary, 'verdict'>, complete: boolean): Verdict {
  const target = TARGETS[cond]
  if (!target) return 'exploratory'
  if (!complete || s.n === 0 || s.comparableRate < MIN_COMPARABLE_RATE || s.gatedMae === null) return 'undecided'
  return s.gatedMae <= target.mae && s.coverage >= target.coverage ? 'pass' : 'fail'
}

function meanOrNull(xs: number[]): number | null {
  return xs.length > 0 ? xs.reduce((s, v) => s + v, 0) / xs.length : null
}

export function summarizePairs(
  rows: PairRow[],
  gateDb: number,
  /** 이만큼 슬롯이 차기 전에는 판정하지 않는다. 자동 평가는 예정 슬롯 수를 넘긴다 */
  minSlots: number = 1,
): Record<Condition, Record<RoiSet, ErrorSummary>> {
  const summarize = (cond: Condition, roi: RoiSet): ErrorSummary => {
    const sub = rows.filter((r) => r.condition === cond)
    const errs: number[] = []
    const gatedErrs: number[] = []
    let withEstimate = 0
    let withReference = 0
    for (const r of sub) {
      const est = r[roi]
      const hasEstimate = est !== null && est !== undefined && Number.isFinite(est.bpm)
      if (hasEstimate) withEstimate++
      if (r.watch !== null) withReference++
      if (!hasEstimate || r.watch === null) continue
      const err = Math.abs(est.bpm - r.watch)
      errs.push(err)
      if (Number.isFinite(est.snrDb) && est.snrDb >= gateDb) gatedErrs.push(err)
    }
    // 슬롯이 덜 찼어도 분모는 예정 슬롯 수다. 저장된 행만 나누면 앞부분 몇 개로 비율이 부풀려진다
    const n = sub.length > 0 ? Math.max(sub.length, minSlots) : 0
    const rate = (count: number) => (n > 0 ? count / n : 0)
    const summary = {
      n,
      mae: meanOrNull(errs),
      coverage: rate(gatedErrs.length),
      gatedMae: meanOrNull(gatedErrs),
      rppgRate: rate(withEstimate),
      refRate: rate(withReference),
      comparableRate: rate(errs.length),
    }
    return { ...summary, verdict: verdictOf(cond, summary, sub.length >= minSlots) }
  }
  const conds: Condition[] = ['quiet', 'talk', 'move']
  return Object.fromEntries(
    conds.map((c) => [
      c,
      { forehead: summarize(c, 'forehead'), all: summarize(c, 'all'), me: summarize(c, 'me') },
    ]),
  ) as Record<Condition, Record<RoiSet, ErrorSummary>>
}
