import { describe, it, expect } from 'vitest'
import {
  resampleUniform,
  spectralPeak,
  estimateHeartRate,
  meanSkinRgb,
  roiRects,
  summarizePairs,
  heartRateFromBvp,
  type RgbSample,
  createFrameClock,
  parseLabRows,
} from '@/features/rppg/lib/rppg'

// ── 테스트 유틸: 결정적 난수 + 합성 피부 신호 ──────────────────────────
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 피부 맥박 시그니처(정규화 RGB 변화 방향, de Haan & van Leest 2014 PBV 근사)
const PULSE_SIG = [0.33, 0.77, 0.53]
const SKIN_BASE = [180, 130, 110]

interface SynthOpts {
  fps: number
  seconds: number
  pulseHz: number
  pulseAmp?: number
  intensityHz?: number
  intensityAmp?: number
  jitterMs?: number
  noise?: number
  seed?: number
}

function synthSkin(o: SynthOpts): RgbSample[] {
  const rand = mulberry32(o.seed ?? 1)
  const pulseAmp = o.pulseAmp ?? 0.005
  const n = Math.round(o.fps * o.seconds)
  const out: RgbSample[] = []
  for (let k = 0; k < n; k++) {
    const jitter = o.jitterMs ? (rand() * 2 - 1) * o.jitterMs : 0
    const t = (k * 1000) / o.fps + jitter
    const ts = t / 1000
    const p = Math.sin(2 * Math.PI * o.pulseHz * ts)
    const i = o.intensityHz ? (o.intensityAmp ?? 0) * Math.sin(2 * Math.PI * o.intensityHz * ts) : 0
    const c = SKIN_BASE.map(
      (base, ch) => base * (1 + i) * (1 + pulseAmp * PULSE_SIG[ch] * p) + (o.noise ?? 0) * (rand() * 2 - 1),
    )
    out.push({ t, r: c[0], g: c[1], b: c[2] })
  }
  return out
}

function sine(hz: number, fs: number, seconds: number, amp = 1): number[] {
  return Array.from({ length: Math.round(fs * seconds) }, (_, k) => amp * Math.sin((2 * Math.PI * hz * k) / fs))
}

// ── resampleUniform ───────────────────────────────────────────────────
describe('resampleUniform', () => {
  it('불규칙 타임스탬프를 fs 간격 격자로 선형 보간한다', () => {
    const samples: RgbSample[] = [
      { t: 0, r: 0, g: 10, b: 20 },
      { t: 100, r: 10, g: 20, b: 40 },
    ]
    // fs=20Hz → 50ms 간격: t=0, 50, 100
    expect(resampleUniform(samples, 20)).toEqual([
      [0, 10, 20],
      [5, 15, 30],
      [10, 20, 40],
    ])
  })

  it('간격이 다른 구간도 각 구간 안에서 보간한다', () => {
    const samples: RgbSample[] = [
      { t: 0, r: 0, g: 0, b: 0 },
      { t: 20, r: 20, g: 0, b: 0 },
      { t: 100, r: 100, g: 0, b: 0 },
    ]
    // fs=25Hz → 40ms 간격: t=0, 40, 80
    const r = resampleUniform(samples, 25).map((c) => c[0])
    expect(r).toEqual([0, 40, 80])
  })
})

// ── spectralPeak ──────────────────────────────────────────────────────
describe('spectralPeak', () => {
  it('1.2Hz 사인 → 72 BPM', () => {
    expect(spectralPeak(sine(1.2, 30, 10), 30).bpm).toBeCloseTo(72, 0)
  })

  it('2.0Hz 사인 → 120 BPM', () => {
    expect(spectralPeak(sine(2.0, 30, 10), 30).bpm).toBeCloseTo(120, 0)
  })

  it('대역(42~180 BPM) 밖의 큰 저주파(호흡 0.2Hz)는 무시한다', () => {
    const resp = sine(0.2, 30, 10, 5)
    const pulse = sine(1.0, 30, 10, 1)
    const x = resp.map((v, k) => v + pulse[k])
    expect(spectralPeak(x, 30).bpm).toBeCloseTo(60, 0)
  })

  it('깨끗한 맥박은 SNR이 높고(>5dB) 백색잡음은 낮다(<0dB)', () => {
    const rand = mulberry32(7)
    const noise = Array.from({ length: 300 }, () => rand() * 2 - 1)
    expect(spectralPeak(sine(1.3, 30, 10), 30).snrDb).toBeGreaterThan(5)
    expect(spectralPeak(noise, 30).snrDb).toBeLessThan(0)
  })
})

// ── estimateHeartRate (리샘플 → POS → 스펙트럼) ─────────────────────────
describe('estimateHeartRate', () => {
  it('30fps 10초 합성 피부 신호에서 맥박을 찾는다 (69 BPM)', () => {
    const hr = estimateHeartRate(synthSkin({ fps: 30, seconds: 10, pulseHz: 1.15, noise: 0.05 }))
    expect(hr).not.toBeNull()
    expect(Math.abs(hr!.bpm - 69)).toBeLessThan(1.5)
  })

  it('프레임 간격이 흔들려도(±8ms) 맥박을 찾는다 (75 BPM)', () => {
    const hr = estimateHeartRate(
      synthSkin({ fps: 30, seconds: 10, pulseHz: 1.25, jitterMs: 8, noise: 0.05, seed: 3 }),
    )
    expect(Math.abs(hr!.bpm - 75)).toBeLessThan(1.5)
  })

  it('대역 안의 밝기 변화(맥박의 4배)를 POS가 상쇄해 맥박을 고른다', () => {
    // 밝기 1.6Hz(96BPM) 2% vs 맥박 1.15Hz(69BPM) 0.5% — 초록 채널만 보면 96을 고르게 되는 조건
    const samples = synthSkin({
      fps: 30,
      seconds: 10,
      pulseHz: 1.15,
      intensityHz: 1.6,
      intensityAmp: 0.02,
      noise: 0.05,
      seed: 5,
    })
    const greenOnly = spectralPeak(samples.map((s) => s.g), 30).bpm
    expect(Math.abs(greenOnly - 96)).toBeLessThan(1.5) // 픽스처가 실제로 어려운 조건인지 확인
    expect(Math.abs(estimateHeartRate(samples)!.bpm - 69)).toBeLessThan(1.5)
  })

  it('데이터가 6초 미만이면 null', () => {
    expect(estimateHeartRate(synthSkin({ fps: 30, seconds: 5, pulseHz: 1.2 }))).toBeNull()
    expect(estimateHeartRate([])).toBeNull()
  })
})

// ── meanSkinRgb ───────────────────────────────────────────────────────
describe('meanSkinRgb', () => {
  function rgba(pixels: number[][]): Uint8ClampedArray {
    return new Uint8ClampedArray(pixels.flatMap(([r, g, b]) => [r, g, b, 255]))
  }

  it('피부색 픽셀만 평균낸다 (파란 배경·검은 머리카락 제외)', () => {
    const data = rgba([
      [224, 172, 140], // 피부
      [200, 150, 120], // 피부
      [0, 0, 255], // 배경
      [30, 25, 20], // 머리카락
    ])
    expect(meanSkinRgb(data)).toEqual({ r: 212, g: 161, b: 130, skinRatio: 0.5 })
  })

  it('피부 픽셀이 하나도 없으면 null', () => {
    expect(meanSkinRgb(rgba([[0, 0, 255], [30, 25, 20]]))).toBeNull()
  })
})

// ── roiRects (68점 랜드마크 → 이마·양볼 사각형) ─────────────────────────
describe('roiRects', () => {
  // 사용하는 점만 채운 정면 얼굴 (이미지 좌표, y는 아래로 증가)
  const pts: { x: number; y: number }[] = []
  pts[1] = { x: 100, y: 230 } // 턱선(이미지 왼쪽)
  pts[8] = { x: 200, y: 380 } // 턱끝
  pts[15] = { x: 300, y: 230 } // 턱선(이미지 오른쪽)
  for (let i = 17; i <= 26; i++) pts[i] = { x: 120 + (i - 17) * 18, y: i === 17 || i === 26 ? 190 : 180 } // 눈썹
  pts[29] = { x: 200, y: 240 } // 콧등 중간
  pts[31] = { x: 180, y: 275 } // 콧볼(왼쪽)
  pts[33] = { x: 200, y: 280 } // 코끝 아래
  pts[35] = { x: 220, y: 275 } // 콧볼(오른쪽)

  const roi = roiRects(pts)

  it('이마는 눈썹보다 위에 있다', () => {
    expect(roi.forehead.y + roi.forehead.h).toBeLessThanOrEqual(180)
    expect(roi.forehead.h).toBeGreaterThan(0)
  })

  it('양볼은 눈 아래·입 위, 코 바깥쪽에 있다', () => {
    for (const c of [roi.leftCheek, roi.rightCheek]) {
      expect(c.y).toBeGreaterThanOrEqual(240)
      expect(c.y + c.h).toBeLessThanOrEqual(280)
      expect(c.w).toBeGreaterThan(0)
    }
    expect(roi.leftCheek.x + roi.leftCheek.w).toBeLessThanOrEqual(180)
    expect(roi.rightCheek.x).toBeGreaterThanOrEqual(220)
  })
})

// ── summarizePairs (워치 정답 vs 앱 추정 → 조건별 오차) ───────────────────
describe('summarizePairs', () => {
  const rows = [
    { condition: 'quiet', watch: 70, forehead: { bpm: 72, snrDb: 3 }, all: { bpm: 75, snrDb: -2 } },
    { condition: 'quiet', watch: 80, forehead: { bpm: 77, snrDb: -1 }, all: { bpm: 80, snrDb: 4 } },
    { condition: 'talk', watch: 90, forehead: null, all: { bpm: 100, snrDb: 1 } },
  ] as const

  it('조건·ROI별 평균절대오차와, 품질 게이트 통과 비율·통과 구간 오차를 낸다', () => {
    const s = summarizePairs([...rows], 0)
    expect(s.quiet.forehead).toEqual({ n: 2, mae: 2.5, coverage: 0.5, gatedMae: 2 })
    expect(s.quiet.all).toEqual({ n: 2, mae: 2.5, coverage: 0.5, gatedMae: 0 })
  })

  it('추정값이 없는 행은 오차에서 빠지고 게이트 미통과로 센다', () => {
    const s = summarizePairs([...rows], 0)
    expect(s.talk.forehead).toEqual({ n: 1, mae: null, coverage: 0, gatedMae: null })
    expect(s.talk.all).toEqual({ n: 1, mae: 10, coverage: 1, gatedMae: 10 })
  })

  it('ME-rPPG 추정값도 같은 방식으로 집계한다', () => {
    const s = summarizePairs(
      [{ condition: 'move', watch: 70, forehead: null, all: null, me: { bpm: 73, snrDb: 2 } }],
      0,
    )
    expect(s.move.me).toEqual({ n: 1, mae: 3, coverage: 1, gatedMae: 3 })
  })

  it('게이트를 올리면 통과 구간이 줄어든다', () => {
    const s = summarizePairs([...rows], 3.5)
    expect(s.quiet.forehead).toEqual({ n: 2, mae: 2.5, coverage: 0, gatedMae: null })
    expect(s.quiet.all).toEqual({ n: 2, mae: 2.5, coverage: 0.5, gatedMae: 0 })
  })
})

// ── heartRateFromBvp (딥러닝 모델이 낸 맥박 파형 → BPM) ─────────────────────
describe('heartRateFromBvp', () => {
  it('타임스탬프가 흔들리는 1.4Hz 파형 → 84 BPM', () => {
    const rand = mulberry32(11)
    const pts = Array.from({ length: 300 }, (_, k) => {
      const t = (k * 1000) / 30 + (rand() * 2 - 1) * 8
      return { t, v: Math.sin((2 * Math.PI * 1.4 * t) / 1000) }
    })
    expect(Math.abs(heartRateFromBvp(pts)!.bpm - 84)).toBeLessThan(1.5)
  })

  it('최근 10초만 본다 — 앞쪽의 다른 박동수는 무시', () => {
    const pts = Array.from({ length: 600 }, (_, k) => {
      const t = (k * 1000) / 30
      const hz = t < 10000 ? 2.0 : 1.0
      return { t, v: Math.sin(2 * Math.PI * hz * (t / 1000)) }
    })
    expect(Math.abs(heartRateFromBvp(pts)!.bpm - 60)).toBeLessThan(1.5)
  })

  it('6초 미만이면 null', () => {
    const pts = Array.from({ length: 150 }, (_, k) => ({ t: (k * 1000) / 30, v: Math.sin(k) }))
    expect(heartRateFromBvp(pts)).toBeNull()
  })
})

describe('측정 신뢰성', () => {
  const pulse = (fps: number, seconds: number, bpm = 72, start = 0) =>
    Array.from({ length: Math.floor(fps * seconds) }, (_, k) => {
      const t = start + (k * 1000) / fps
      const s = 2 * Math.sin((2 * Math.PI * bpm * t) / 60000)
      return { t, r: 120 + s * 0.3, g: 110 + s, b: 100 + s * 0.4 }
    })

  it.each([15, 24, 30])('%i fps 타임스탬프도 같은 심박으로 추정한다', (fps) => {
    expect(estimateHeartRate(pulse(fps, 10))!.bpm).toBeCloseTo(72, 0)
  })

  it('긴 공백을 가로질러 추정하지 않는다', () => {
    const samples = [...pulse(30, 1), ...pulse(30, 1, 72, 9000)]
    expect(estimateHeartRate(samples)).toBeNull()
  })

  it('공백 뒤 이어진 구간만으로 추정하고 실제 창을 돌려준다', () => {
    const samples = [...pulse(30, 3), ...pulse(30, 8, 72, 12000)]
    const est = estimateHeartRate(samples)!
    expect(est.bpm).toBeCloseTo(72, 0)
    expect(est.windowStart).toBe(12000)
  })

  it('입력이 너무 드물면 추정하지 않는다', () => {
    expect(estimateHeartRate(pulse(5, 10))).toBeNull()
  })

  it('무신호는 심박으로 세지 않는다', () => {
    const flat = Array.from({ length: 300 }, (_, k) => ({ t: (k * 1000) / 30, r: 100, g: 100, b: 100 }))
    expect(estimateHeartRate(flat)).toBeNull()
    expect(heartRateFromBvp(flat.map((p) => ({ t: p.t, v: 0 })))).toBeNull()
  })

  it('멀리 떨어진 맥박 파형 두 점으로 추정하지 않는다', () => {
    expect(heartRateFromBvp([{ t: 0, v: 0 }, { t: 10000, v: 1 }])).toBeNull()
  })

  it('프레임 시각 출처를 고정하고 역행한 프레임을 버린다', () => {
    const clock = createFrameClock()
    expect(clock.next(100, 50)).toBe(50)
    expect(clock.source()).toBe('capture')
    expect(clock.next(133, undefined)).toBeNull()
    expect(clock.next(166, 40)).toBeNull()
    expect(clock.next(199, 83)).toBe(83)
    const display = createFrameClock()
    expect(display.next(10, undefined)).toBe(10)
    expect(display.next(20, 5)).toBe(20)
  })

  it('저장 기록을 복원할 때 깨진 행과 품질 없는 추정을 거른다', () => {
    const good = {
      t: 1,
      fps: 30,
      condition: 'quiet',
      watch: 70,
      forehead: { bpm: 71, snrDb: null },
      all: { bpm: 72, snrDb: 2 },
      me: null,
    }
    const rows = parseLabRows(JSON.stringify([good, { condition: 'quiet' }, 3]))
    expect(rows).toHaveLength(1)
    expect(rows[0].forehead).toBeNull()
    expect(rows[0].all?.bpm).toBe(72)
    expect(parseLabRows('깨진 JSON')).toEqual([])
    expect(parseLabRows('{}')).toEqual([])
  })
})
