import { describe, it, expect } from 'vitest'
import { gateReading, ME_WARMUP, pulseLevel, SETTLE_MS, STALE_MS, type GateInput } from '@/features/rppg/engine/rppgGate'

const NOW = 100_000
const base: GateInput = {
  engine: 'ready',
  face: true,
  outputs: ME_WARMUP + 100,
  lastFrameT: NOW - 100,
  now: NOW,
  estimate: { bpm: 72, snrDb: 3 },
  firstEstimateAt: NOW - SETTLE_MS,
  minSnrDb: 0,
}

describe('rPPG 품질 게이트', () => {
  it('모든 기준을 넘으면 심박을 보여준다', () => {
    expect(gateReading(base)).toMatchObject({ status: 'live', bpm: 72, snrDb: 3 })
  })

  it('준비 중·오류·얼굴 없음은 심박을 내지 않는다', () => {
    expect(gateReading({ ...base, engine: 'loading' })).toMatchObject({ status: 'loading', bpm: null })
    expect(gateReading({ ...base, engine: 'error' })).toMatchObject({ status: 'error', bpm: null })
    expect(gateReading({ ...base, face: false })).toMatchObject({ status: 'noFace', bpm: null })
  })

  it('워밍업 출력 30개 이하이면 아직 모으는 중이다', () => {
    expect(gateReading({ ...base, outputs: ME_WARMUP })).toMatchObject({ status: 'warming', bpm: null })
  })

  it('마지막 출력의 원본 프레임이 2초 이상 지났으면 이전 값을 보여주지 않는다', () => {
    expect(gateReading({ ...base, lastFrameT: NOW - STALE_MS })).toMatchObject({ status: 'warming', bpm: null })
  })

  it('연속성·밀도 기준을 못 넘어 추정이 없으면 모으는 중이다', () => {
    expect(gateReading({ ...base, estimate: null })).toMatchObject({ status: 'warming', bpm: null })
  })

  it('첫 추정 뒤 안정화 시간(12초) 동안은 보이지 않는다', () => {
    expect(gateReading({ ...base, firstEstimateAt: NOW - SETTLE_MS + 1 })).toMatchObject({ status: 'warming', bpm: null })
    expect(gateReading({ ...base, firstEstimateAt: null })).toMatchObject({ status: 'warming', bpm: null })
    expect(gateReading({ ...base, firstEstimateAt: NOW - SETTLE_MS })).toMatchObject({ status: 'live', bpm: 72 })
  })

  it('SNR 이 기준 미만이면 신호 약함으로 숨긴다', () => {
    expect(gateReading({ ...base, estimate: { bpm: 90, snrDb: -1.5 } })).toMatchObject({
      status: 'lowSignal',
      bpm: null,
      snrDb: -1.5,
    })
    expect(gateReading({ ...base, minSnrDb: 5 })).toMatchObject({ status: 'lowSignal', bpm: null })
  })
})

describe('pulseLevel', () => {
  it('최근 3초의 최소·최대로 마지막 값을 0~1 로 맞춘다', () => {
    const buf = [
      { t: 0, v: -2 },
      { t: 1000, v: 2 },
      { t: 2000, v: 0 },
    ]
    expect(pulseLevel(buf)).toBeCloseTo(0.5)
  })

  it('값이 없거나 평평하면 0이다', () => {
    expect(pulseLevel([])).toBe(0)
    expect(pulseLevel([{ t: 0, v: 1 }, { t: 10, v: 1 }])).toBe(0)
  })

  it('3초보다 오래된 값은 범위에 넣지 않는다', () => {
    const buf = [
      { t: 0, v: 100 },
      { t: 5000, v: 0 },
      { t: 6000, v: 1 },
    ]
    expect(pulseLevel(buf)).toBe(1)
  })
})
