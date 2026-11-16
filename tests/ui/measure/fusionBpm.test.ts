import { describe, expect, it } from 'vitest'
import { liveFusedState, type FusedSample } from '@/features/algorithm/stress/fusedStress'
import { fusionBpm } from '@/features/ui/measure/demo/useLiveFusedState'

describe('fusionBpm: 결합 판정에 넣을 심박', () => {
  it('유효한 워치 값은 그대로 넣는다(카메라 품질과 무관)', () => {
    expect(fusionBpm({ bpm: 72, source: 'watch', rppgQuality: 'motion' })).toBe(72)
    expect(fusionBpm({ bpm: 72, source: 'watch', rppgQuality: null })).toBe(72)
  })

  it('카메라 값은 품질이 good 일 때만 넣는다', () => {
    expect(fusionBpm({ bpm: 74, source: 'rppg', rppgQuality: 'good' })).toBe(74)
    for (const q of ['motion', 'lowSignal', 'settling'] as const) {
      expect(fusionBpm({ bpm: 95, source: 'rppg', rppgQuality: q })).toBeNull()
    }
    expect(fusionBpm({ bpm: 95, source: 'rppg', rppgQuality: null })).toBeNull()
  })

  it('심박이 없으면 null', () => {
    expect(fusionBpm({ bpm: null, source: null, rppgQuality: null })).toBeNull()
  })

  it('기준 뒤 카메라 참고값이 최근 구간을 채워도 심박 상승으로 판정하지 않는다', () => {
    // 첫 2분: 워치 72 BPM(±3), 표정 부정 30%. 그 뒤 1분: 워치가 끊기고 카메라가 움직임 참고값 95 BPM 을 낸다
    const samples: FusedSample[] = []
    for (let t = 0; t < 120; t++) {
      samples.push({ t, bpm: fusionBpm({ bpm: 72 + ((t % 3) - 1) * 3, source: 'watch', rppgQuality: null }), neg: 0.3 })
    }
    for (let t = 120; t < 180; t++) {
      samples.push({ t, bpm: fusionBpm({ bpm: 95, source: 'rppg', rppgQuality: 'motion' }), neg: 0.3 })
    }
    const state = liveFusedState(samples, 179)
    expect(state?.hr).toBeNull()
    expect(state?.a).toBeNull()
    expect(state?.s).toBeCloseTo(30)
  })
})
