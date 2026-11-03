import { describe, it, expect } from 'vitest'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import {
  parseDemoSession,
  peakWithEmotion,
  smoothBpm,
  summarizeSession,
  type DemoSession,
  type TimelinePoint,
} from '@/features/ui/measure/demo/sessionLog'

function makeSession(samples: TimelinePoint[]): DemoSession {
  const durationSec = samples[samples.length - 1].t
  return { startedAt: 0, endedAt: durationSec * 1000, durationSec, samples }
}

/** durationSec 초짜리 측정. spike 구간만 심박이 높고 화남, 나머지는 평온. */
function makeSpike(durationSec: number, spike: [number, number]): DemoSession {
  return makeSession(
    Array.from({ length: durationSec + 1 }, (_, t) => {
      const hot = t >= spike[0] && t <= spike[1]
      return { t, bpm: hot ? 95 : 70, emotion: (hot ? 'angry' : 'calm') as Emotion }
    }),
  )
}

describe('summarizeSession 의 심박이 가장 높았던 구간', () => {
  it('30초 측정에서도 심박이 높은 구간을 잡고, 그 구간의 색은 가장 오래 머문 감정이다', () => {
    const session = makeSpike(30, [14, 21])
    const peak = peakWithEmotion(session, summarizeSession(session))
    expect(peak).not.toBeNull()
    expect(peak!.start).toBeGreaterThanOrEqual(12)
    expect(peak!.end).toBeLessThanOrEqual(23)
    expect(peak!.emotion).toBe('angry')
  })

  it('측정이 너무 짧으면(15초) 구간을 고르지 않는다', () => {
    expect(summarizeSession(makeSpike(15, [5, 9])).peakWindow).toBeNull()
  })

  it('심박이 하나도 없으면(rPPG 연결 전) 심박 값과 구간을 만들지 않는다', () => {
    const session = makeSession(Array.from({ length: 61 }, (_, t) => ({ t, bpm: null, emotion: 'calm' as Emotion })))
    const summary = summarizeSession(session)
    expect(summary.avgBpm).toBeNull()
    expect(summary.maxBpm).toBeNull()
    expect(summary.peakWindow).toBeNull()
  })
})

describe('summarizeSession 의 감정 비율', () => {
  it('얼굴을 못 찾은 표본은 평온으로 세지 않고 비율에서 뺀다', () => {
    const samples: TimelinePoint[] = [
      { t: 0, bpm: null, emotion: null },
      { t: 1, bpm: null, emotion: null },
      { t: 2, bpm: null, emotion: 'sad' },
      { t: 3, bpm: null, emotion: 'sad' },
      { t: 4, bpm: null, emotion: 'calm' },
    ]
    const summary = summarizeSession(makeSession(samples))
    expect(summary.dominant).toBe('sad')
    expect(summary.shares.sad).toBeCloseTo(2 / 3)
    expect(summary.shares.calm).toBeCloseTo(1 / 3)
    expect(summary.detectedRatio).toBeCloseTo(3 / 5)
  })

  it('얼굴을 한 번도 찾지 못했으면 우세 감정이 없고 비율은 모두 0이다', () => {
    const summary = summarizeSession(makeSession([{ t: 0, bpm: null, emotion: null }, { t: 1, bpm: null, emotion: null }]))
    expect(summary.dominant).toBeNull()
    expect(Object.values(summary.shares).every((v) => v === 0)).toBe(true)
    expect(summary.detectedRatio).toBe(0)
  })
})

describe('smoothBpm', () => {
  it('심박이 빠진 자리는 메우지 않고 null 로 둔다', () => {
    expect(smoothBpm([70, null, 80])).toEqual([70, null, 80])
  })
})

describe('parseDemoSession', () => {
  it('표본이 둘 미만인 기록은 받지 않는다', () => {
    const one = JSON.stringify({ startedAt: 0, endedAt: 1000, durationSec: 1, samples: [{ t: 0, bpm: null, emotion: null }] })
    expect(parseDemoSession(one)).toBeNull()
  })
})
