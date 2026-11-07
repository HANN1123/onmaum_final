import { describe, expect, it } from 'vitest'
import { cleanBpmSeries, initialDisplayBpmState, nextDisplayBpm, SERIES_BPM_OPTIONS, type BpmSample } from '@/features/rppg/lib/bpmCleaning'

describe('실시간 심박 다듬기', () => {
  it('현재까지의 표본만 쓰고 입력 상태를 수정하지 않는다', () => {
    const initial = initialDisplayBpmState()
    const first = nextDisplayBpm(initial, { t: 0, bpm: 72, quality: 'good' })
    const next = nextDisplayBpm(first, { t: 1, bpm: 140, quality: 'motion' })
    expect(initial.history).toEqual([])
    expect(first.history).toHaveLength(1)
    expect(next.bpm).toBe(72)
    expect(next.history.at(-1)?.bpm).toBe(140)
  })

  it('참고값 이탈은 잠시 보류하고 계속되는 변화는 제한된 속도로 따라간다', () => {
    let state = nextDisplayBpm(initialDisplayBpmState(), { t: 0, bpm: 72, quality: 'good' })
    for (let t = 1; t <= 4; t++) state = nextDisplayBpm(state, { t, bpm: 120, quality: 'motion' })
    expect(state.bpm).toBe(72)
    state = nextDisplayBpm(state, { t: 5, bpm: 120, quality: 'motion' })
    expect(state.bpm).toBeGreaterThan(72)
    expect(state.bpm).toBeLessThanOrEqual(76)
  })

  it('good 이력이 없으면 전체 중앙값을 쓰며 good 급변도 초당 변화량을 제한한다', () => {
    let state = nextDisplayBpm(initialDisplayBpmState(), { t: 0, bpm: 70, quality: 'settling' })
    state = nextDisplayBpm(state, { t: 1, bpm: 140, quality: 'lowSignal' })
    expect(state.bpm).toBe(70)
    state = nextDisplayBpm(state, { t: 2, bpm: 100, quality: 'good' })
    expect(state.bpm).toBeLessThanOrEqual(74)
  })

  it('결측·시간 역행·긴 공백 뒤에는 이전 표시값을 재사용하지 않는다', () => {
    const state = nextDisplayBpm(initialDisplayBpmState(), { t: 10, bpm: 72 })
    expect(nextDisplayBpm(state, { t: 11, bpm: null }).bpm).toBeNull()
    expect(nextDisplayBpm(state, { t: 9, bpm: 100 }).bpm).toBe(100)
    expect(nextDisplayBpm(state, { t: 20, bpm: 100 }).bpm).toBe(100)
  })
})

describe('기록된 심박 사후 정리', () => {
  const steady = (): BpmSample[] => Array.from({ length: 41 }, (_, t) => ({ t, bpm: 72 }))

  it('고립된 큰 이상값을 null로 제거하고 선택한 경우에만 짧은 구간을 보간한다', () => {
    const samples = steady()
    samples[20] = { t: 20, bpm: 150, quality: 'motion' }
    expect(cleanBpmSeries(samples)[20].bpm).toBeNull()
    expect(cleanBpmSeries(samples, { ...SERIES_BPM_OPTIONS, gapSec: 3 })[20].bpm).toBe(72)
    expect(samples[20].bpm).toBe(150)
  })

  it('품질 없는 옛 표본은 good이며 참고값에는 더 엄격한 기준을 적용한다', () => {
    const old = steady()
    old[20].bpm = 82
    expect(cleanBpmSeries(old)[20].bpm).toBe(82)
    old[20].quality = 'lowSignal'
    expect(cleanBpmSeries(old)[20].bpm).toBeNull()
  })

  it('원래 결측·긴 제거 구간·끝부분은 보간하지 않는다', () => {
    const samples = steady()
    samples[4].bpm = null
    for (let t = 18; t <= 21; t++) samples[t] = { t, bpm: 150, quality: 'motion' }
    samples[40] = { t: 40, bpm: 150, quality: 'motion' }
    const cleaned = cleanBpmSeries(samples)
    expect(cleaned[4].bpm).toBeNull()
    expect(cleaned.slice(18, 22).every(s => s.bpm === null)).toBe(true)
    expect(cleaned[40].bpm).toBeNull()
  })

  it('불규칙 시각의 긴 공백을 짧은 표본 개수로 오인해 메우지 않는다', () => {
    const samples = steady().map(s => ({ ...s, t: s.t * 5 }))
    samples[20].bpm = 150
    expect(cleanBpmSeries(samples)[20].bpm).toBeNull()
    expect(cleanBpmSeries([])).toEqual([])
  })

  it('보간을 끄면 초보다 촘촘한 표본에서도 제거값을 null로 둔다', () => {
    const samples = steady().map(s => ({ ...s, t: s.t / 10 }))
    samples[20].bpm = 150
    expect(cleanBpmSeries(samples)[20].bpm).toBeNull()
  })
})
