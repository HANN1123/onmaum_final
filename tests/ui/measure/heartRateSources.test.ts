import { describe, expect, it } from 'vitest'
import { cleanBpmSeries } from '@/features/rppg/lib/bpmCleaning'
import { bpmOrigin } from '@/features/rppg/lib/heartRateSource'
import { heartRateRuns, parseDemoSession, smoothBpm, sourceShareText, summarizeSession, type TimelinePoint } from '@/features/ui/measure/demo/sessionLog'

const session = (samples: TimelinePoint[]) => ({ startedAt: 0, endedAt: 30000, durationSec: 30, samples })
const point = (t: number, bpm: number | null, source?: 'watch' | 'rppg'): TimelinePoint => ({ t, bpm, source, emotion: null })

describe('출처별 기록 정리와 결과', () => {
  it('워치 급변·낮은 rPPG 품질도 보존하며 카메라만 같은 출처 구간 안에서 정리한다', () => {
    const samples = Array.from({ length: 41 }, (_, t) => ({ ...point(t, 72, 'rppg'), quality: 'good' as const }))
    const mixed: TimelinePoint[] = samples
    mixed[10] = { ...point(10, 180, 'watch'), quality: 'motion' }
    mixed[25] = { ...point(25, 180, 'rppg'), quality: 'motion' }
    const cleaned = cleanBpmSeries(mixed)
    expect(cleaned[10]).toEqual(mixed[10])
    expect(cleaned[25].bpm).toBeNull()
    const short = [point(0, 70, 'rppg'), ...Array.from({ length: 5 }, (_, i) => point(i + 1, 180, 'watch')), point(6, 70, 'rppg')]
    expect(cleanBpmSeries(short)).toEqual(short)
  })
  it('워치와 카메라·null·시간 공백을 넘어 이동평균하지 않는다', () => {
    const points = [point(0, 60, 'rppg'), point(1, 80, 'rppg'), point(2, 180, 'watch'), point(3, 200, 'watch'), point(4, 100, 'rppg'), point(5, null), point(6, 40, 'rppg'), point(10, 80, 'rppg')]
    expect(smoothBpm(points.map((p) => p.bpm), points)).toEqual([70, 70, 180, 200, 100, null, 40, 80])
  })
  it('그래프는 출처 경계·null·시간 공백에서 나누고 한 표본 구간도 남긴다', () => {
    const points = [point(0, 70), point(1, 71), point(2, 90, 'watch'), point(3, null), point(4, 92, 'watch'), point(8, 93, 'watch'), point(9, 72, 'rppg')]
    expect(heartRateRuns(points)).toEqual([
      { source: 'rppg', indexes: [0, 1] }, { source: 'watch', indexes: [2] },
      { source: 'watch', indexes: [4] }, { source: 'watch', indexes: [5] }, { source: 'rppg', indexes: [6] },
    ])
  })
  it('옛 기록은 유효한 심박만 카메라로 읽고 기존 숫자 배열 다듬기를 유지한다', () => {
    const old = session([point(0, 60), point(1, null), point(2, 80)])
    const parsed = parseDemoSession(JSON.stringify(old))!
    expect(parsed.samples.map(bpmOrigin)).toEqual(['rppg', null, 'rppg'])
    expect(smoothBpm([60, null, 80])).toEqual([60, null, 80])
    expect(summarizeSession(parsed).sourceShares).toEqual({ watch: 0, rppg: 1 })
  })
  it('정리 후 유효 표본 수로 출처 비율을 구하고 요약 최고값은 이동평균하지 않는다', () => {
    const points = [point(0, 60, 'rppg'), point(1, null), point(2, 100, 'watch'), point(3, 120, 'watch')]
    const summary = summarizeSession(session(points))
    expect(summary.sourceShares.watch).toBeCloseTo(2 / 3)
    expect(sourceShareText(summary.sourceShares)).toBe('워치 67% · 카메라 33%')
    expect(summary.avgBpm).toBe(93)
    expect(summary.maxBpm).toBe(120)
    expect(sourceShareText(summarizeSession(session([point(0, null), point(1, null)])).sourceShares)).toBe('심박 기록 없음')
    expect(sourceShareText({ watch: 1, rppg: 0 })).toBe('워치')
    expect(sourceShareText({ watch: 0, rppg: 1 })).toBe('카메라')
  })
  it('정리로 제거한 카메라 표본은 출처 비율 분모에서도 제외한다', () => {
    const points = Array.from({ length: 12 }, (_, t) => point(t, 70, 'rppg'))
    points[5] = { ...point(5, 200, 'rppg'), quality: 'motion' }
    points.push(point(12, 95, 'watch'))
    const summary = summarizeSession(session(points))
    expect(summary.sourceShares.watch).toBeCloseTo(1 / 12)
    expect(summary.maxBpm).toBe(95)
  })
})
