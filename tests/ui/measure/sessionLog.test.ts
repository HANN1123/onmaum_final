import { describe, it, expect } from 'vitest'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { hardestWithEmotion, summarizeSession, type DemoSession } from '@/features/ui/measure/demo/sessionLog'

/** durationSec 초짜리 통화. spike 구간만 심박이 높고 화남, 나머지는 평온. */
function makeCall(durationSec: number, spike: [number, number]): DemoSession {
  const samples = Array.from({ length: durationSec + 1 }, (_, t) => {
    const hot = t >= spike[0] && t <= spike[1]
    return { t, bpm: hot ? 95 : 70, emotion: (hot ? 'angry' : 'calm') as Emotion }
  })
  return { startedAt: 0, endedAt: durationSec * 1000, durationSec, samples }
}

describe('summarizeSession 의 가장 힘든 구간', () => {
  it('30초 통화에서도 화남·높은 심박 구간을 가장 힘든 구간으로 잡는다', () => {
    const session = makeCall(30, [14, 21])
    const hardest = hardestWithEmotion(session, summarizeSession(session))
    expect(hardest).not.toBeNull()
    expect(hardest!.start).toBeGreaterThanOrEqual(12)
    expect(hardest!.end).toBeLessThanOrEqual(23)
    expect(hardest!.emotion).toBe('angry')
  })

  it('통화가 너무 짧으면(15초) 구간을 나누지 않는다', () => {
    const session = makeCall(15, [5, 9])
    expect(summarizeSession(session).hardest).toBeNull()
  })
})
