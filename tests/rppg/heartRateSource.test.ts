import { describe, expect, it } from 'vitest'
import { initialHeartRateSelectionState, selectHeartRate, WATCH_STALE_MS, type WatchSample } from '@/features/rppg/lib/heartRateSource'

const latest: WatchSample = { t: 1000, bpm: 90, contact: 'good' }
const base = { latest, status: 'connected' as const, now: 1000, rppgBpm: 70, rppgQuality: 'motion' as const }

describe('표시 심박 출처 선택', () => {
  it('워치를 우선하며 rPPG 품질을 덮어쓰거나 값을 평균하지 않는다', () => {
    expect(selectHeartRate(base)).toMatchObject({ bpm: 90, source: 'watch', rppgQuality: 'motion' })
    expect(selectHeartRate({ ...base, latest: { ...latest, contact: 'unsupported' } }).source).toBe('watch')
  })
  it('정확히 8초까지 유지하고 그 다음부터 카메라로 대체한다', () => {
    expect(WATCH_STALE_MS).toBe(8000)
    expect(selectHeartRate({ ...base, now: latest.t + WATCH_STALE_MS }).source).toBe('watch')
    expect(selectHeartRate({ ...base, now: latest.t + WATCH_STALE_MS + 0.01 }).source).toBe('rppg')
  })
  it.each([
    { latest: null }, { status: 'idle' as const }, { status: 'connecting' as const },
    { latest: { ...latest, contact: 'poor' as const } },
    ...[29, 221, NaN, Infinity].map((bpm) => ({ latest: { ...latest, bpm } })),
    ...[NaN, Infinity, 1001].map((t) => ({ latest: { ...latest, t } })),
    { now: NaN },
  ])('워치가 사용 불가능하면 즉시 카메라로 전환한다: %j', (change) => {
    expect(selectHeartRate({ ...base, ...change })).toMatchObject({ bpm: 70, source: 'rppg' })
  })
  it('30과 220은 허용하며 두 원천이 없거나 비유한수면 출처도 없다', () => {
    for (const bpm of [30, 220]) expect(selectHeartRate({ ...base, latest: { ...latest, bpm } }).bpm).toBe(bpm)
    expect(selectHeartRate({ ...base, latest: null, rppgBpm: null })).toMatchObject({ bpm: null, source: null })
    expect(selectHeartRate({ ...base, latest: null, rppgBpm: NaN }).source).toBeNull()
  })
  it('같은 알림 재평가는 상태를 누적하지 않으며 정상 새 알림 한 번으로 복귀한다', () => {
    const first = selectHeartRate(base)
    expect(selectHeartRate(base, first.state)).toEqual(first)
    const expired = selectHeartRate({ ...base, now: 10000 }, first.state)
    expect(expired.source).toBe('rppg')
    expect(selectHeartRate({ ...base, latest: { ...latest, t: 10000 }, now: 10000 }, expired.state).source).toBe('watch')
    const disconnected = selectHeartRate({ ...base, status: 'idle' }, first.state)
    expect(disconnected.state.lastWatchT).toBeNull()
    expect(initialHeartRateSelectionState()).toEqual({ source: null, lastWatchT: null })
    expect(selectHeartRate({ ...base, rppgBpm: null }).bpm).toBe(90)
  })
})
