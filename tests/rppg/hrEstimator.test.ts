import { describe, expect, it } from 'vitest'
import {
  bandpass,
  createHrTracker,
  maskMotion,
  motionAmplitude,
  MOTION_MASK_RATIO,
  type BoxSample,
  type BvpPoint,
} from '@/features/rppg/lib/hrEstimator'

const FS = 30

/** bpm 사인파 맥박(+선택적 다른 성분)을 30fps 로 만든다 */
function pulse(seconds: number, bpm: number, extra: (t: number) => number = () => 0, t0 = 0): BvpPoint[] {
  const out: BvpPoint[] = []
  for (let i = 0; i < seconds * FS; i++) {
    const t = t0 + (i * 1000) / FS
    out.push({ t, v: Math.sin((2 * Math.PI * bpm * t) / 60_000) + extra(t) })
  }
  return out
}

function boxes(seconds: number, nod: (t: number) => number = () => 0, t0 = 0): BoxSample[] {
  const out: BoxSample[] = []
  for (let i = 0; i < seconds * FS; i++) {
    const t = t0 + (i * 1000) / FS
    out.push({ t, cx: 320, cy: 240 + nod(t), w: 100 })
  }
  return out
}

describe('bandpass', () => {
  it('맥박 대역 밖의 느린 흔들림을 줄이고 맥박은 남긴다', () => {
    const n = 300
    const slow = Array.from({ length: n }, (_, k) => 5 * Math.sin((2 * Math.PI * 0.2 * k) / FS))
    const beat = Array.from({ length: n }, (_, k) => Math.sin((2 * Math.PI * 1.3 * k) / FS))
    const rms = (x: number[]) => Math.sqrt(x.slice(60, -60).reduce((s, v) => s + v * v, 0) / (x.length - 120))
    expect(rms(bandpass(slow))).toBeLessThan(rms(slow) * 0.25)
    expect(rms(bandpass(beat))).toBeGreaterThan(rms(beat) * 0.8)
  })
})

describe('motionAmplitude / maskMotion', () => {
  it('얼굴 상자가 66 BPM 으로 끄덕이면 그 주파수의 진폭이 기준을 넘는다', () => {
    const amp = motionAmplitude(boxes(10, (t) => 4 * Math.sin((2 * Math.PI * 1.1 * t) / 1000)))!
    // 격자 0.7Hz 부터 1 BPM 간격 → 66 BPM 은 24번째 칸
    const i66 = 66 - 42
    expect(amp[i66]).toBeGreaterThan(MOTION_MASK_RATIO)
    expect(amp[90 - 42]).toBeLessThan(MOTION_MASK_RATIO)
  })

  it('가만히 있으면 진폭이 기준보다 작다', () => {
    const amp = motionAmplitude(boxes(10))!
    expect(Math.max(...amp)).toBeLessThan(MOTION_MASK_RATIO)
  })

  it('기준을 넘은 주파수 주변만 지운다', () => {
    const power = Array.from({ length: 10 }, () => 1)
    const motion = power.map((_, i) => (i === 5 ? 0.05 : 0))
    const masked = maskMotion(power, motion)
    expect(masked[5]).toBeLessThan(0.1)
    expect(masked[2]).toBeLessThan(0.1)
    expect(masked[9]).toBe(1)
  })
})

describe('createHrTracker', () => {
  it('두 모델 파형을 합쳐 심박을 낸다', () => {
    const tr = createHrTracker()
    const est = tr.estimate([pulse(12, 78), pulse(12, 78)])!
    expect(est.bpm).toBeCloseTo(78, 0)
    expect(est.models).toBe(2)
    expect(est.motion).toBeNull()
  })

  it('한 모델만 다른 피크를 내도 둘이 겹치는 피크를 고른다', () => {
    const tr = createHrTracker()
    const a = pulse(12, 80)
    const b = pulse(12, 80, (t) => 1.2 * Math.sin((2 * Math.PI * 110 * t) / 60_000))
    expect(tr.estimate([a, b])!.bpm).toBeCloseTo(80, 0)
  })

  it('끄덕임 주파수(66 BPM)가 맥박보다 강해도 상자 기록이 있으면 맥박을 고른다', () => {
    const nod = (t: number) => Math.sin((2 * Math.PI * 1.1 * t) / 1000)
    const bvp = pulse(12, 84, (t) => 2 * nod(t))
    const plain = createHrTracker().estimate([bvp])!
    expect(plain.bpm).toBeCloseTo(66, 0)
    const masked = createHrTracker().estimate([bvp], boxes(12, (t) => 4 * nod(t)))!
    expect(masked.bpm).toBeCloseTo(84, 0)
    expect(masked.motion!).toBeGreaterThan(MOTION_MASK_RATIO)
  })

  it('직전 값 근처를 우선하되, 다른 피크가 훨씬 강하면 넘어간다', () => {
    const tr = createHrTracker()
    expect(tr.estimate([pulse(12, 70)])!.bpm).toBeCloseTo(70, 0)
    // 2초 뒤, 같은 세기의 두 피크(70, 100) → 직전 70 쪽
    const two = pulse(12, 70, (t) => Math.sin((2 * Math.PI * 100 * t) / 60_000), 2_000)
    expect(tr.estimate([two])!.bpm).toBeCloseTo(70, 0)
    // 100 BPM 만 남으면 따라간다
    expect(tr.estimate([pulse(12, 100, () => 0, 4_000)])!.bpm).toBeCloseTo(100, 0)
  })

  it('직전 추정이 3초보다 오래되면 추적하지 않는다', () => {
    const tr = createHrTracker()
    tr.estimate([pulse(12, 70)])
    // 이스케이프(3dB)에 못 미치는 조금 센 경쟁 피크: 만료됐으면 더 센 100, 추적 중이면 70
    const two = (t0: number) => pulse(12, 70, (t) => 1.05 * Math.sin((2 * Math.PI * 100 * t) / 60_000), t0)
    expect(tr.estimate([two(20_000)])!.bpm).toBeCloseTo(100, 0)
    const fresh = createHrTracker()
    fresh.estimate([pulse(12, 70)])
    expect(fresh.estimate([two(2_000)])!.bpm).toBeCloseTo(70, 0)
  })

  it('reset() 하면 직전 값을 잊는다', () => {
    const tr = createHrTracker()
    tr.estimate([pulse(12, 70)])
    tr.reset()
    const two = pulse(12, 70, (t) => 1.05 * Math.sin((2 * Math.PI * 100 * t) / 60_000), 2_000)
    expect(tr.estimate([two])!.bpm).toBeCloseTo(100, 0)
  })

  it('모델마다 이어진 구간이 달라도 공통 구간만 분석하고 그 구간을 돌려준다', () => {
    const a = pulse(12, 80)
    // b 는 4초에 1초 공백이 있어 5초~12초만 이어진다
    const b = pulse(12, 80).filter((p) => p.t < 4_000 || p.t >= 5_000)
    const est = createHrTracker().estimate([a, b])!
    expect(est.models).toBe(2)
    expect(est.windowStart).toBeGreaterThanOrEqual(5_000)
    expect(est.windowEnd! - est.windowStart!).toBeGreaterThanOrEqual(6_000)
  })

  it('공백 때문에 6초가 안 되는 모델은 빼고, 남은 모델로 추정한다', () => {
    const a = pulse(12, 80)
    const b = pulse(12, 80).filter((p) => p.t < 7_000 || p.t >= 8_000)
    expect(createHrTracker().estimate([a, b])!.models).toBe(1)
    expect(createHrTracker().estimate([b])).toBeNull()
  })

  it('입력이 10fps 보다 드물면 쓰지 않는다', () => {
    const sparse = pulse(12, 80).filter((_, i) => i % 4 === 0)
    expect(createHrTracker().estimate([sparse])).toBeNull()
  })

  it('6초보다 짧거나 끊긴 버퍼는 쓰지 않는다', () => {
    const tr = createHrTracker()
    expect(tr.estimate([pulse(4, 80)])).toBeNull()
    expect(tr.estimate([])).toBeNull()
  })
})
