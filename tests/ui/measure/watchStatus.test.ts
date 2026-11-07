import { describe, it, expect } from 'vitest'
import { watchView, pulseOrigin, WATCH_STALE_MS, type WatchInput } from '@/features/ui/measure/demo/watchStatus'

const base: WatchInput = { supported: true, status: 'idle', latest: null, failure: null, now: 100_000, rppgBpm: null }
const sample = (t: number, bpm = 81, contact: 'good' | 'poor' | 'unsupported' = 'good') => ({ t, bpm, contact })

describe('워치 행 상태', () => {
  it('Web Bluetooth가 없으면 지원 안 함이고 버튼이 없다', () => {
    expect(watchView({ ...base, supported: false })).toMatchObject({ state: 'unsupported', action: null })
  })

  it('연결 전에는 연결 버튼, 연결 중에는 버튼이 없다', () => {
    expect(watchView(base)).toMatchObject({ state: 'idle', text: '연결 안 됨', action: 'connect' })
    expect(watchView({ ...base, status: 'connecting' })).toMatchObject({ state: 'connecting', action: null })
  })

  it('연결 뒤 첫 값을 기다리는 동안과 값을 받는 동안을 구분하고, 끊기 버튼을 둔다', () => {
    expect(watchView({ ...base, status: 'connected' })).toMatchObject({ state: 'waiting', action: 'disconnect' })
    expect(watchView({ ...base, status: 'connected', latest: sample(99_000) })).toMatchObject({ state: 'live', text: '81 BPM', action: 'disconnect' })
  })

  it('실측 최대 6.06초 간격을 허용하고 8초 넘게 새 값이 없으면 신호 없음이다', () => {
    expect(watchView({ ...base, status: 'connected', latest: sample(100_000 - 6060) }).state).toBe('live')
    expect(watchView({ ...base, status: 'connected', latest: sample(100_000 - WATCH_STALE_MS) }).state).toBe('live')
    const v = watchView({ ...base, status: 'connected', latest: sample(100_000 - WATCH_STALE_MS - 1) })
    expect(v).toMatchObject({ state: 'stale', action: 'disconnect' })
  })

  it('미래·비유한 시각·범위 밖 심박은 정상으로 표시하지 않는다', () => {
    for (const latest of [sample(100_001), sample(NaN), sample(99_000, 29), sample(99_000, 221), sample(99_000, NaN)]) {
      expect(watchView({ ...base, status: 'connected', latest }).state).toBe('stale')
    }
  })

  it('접촉 불량이면 값을 보이지 않고 착용 확인을 안내한다', () => {
    expect(watchView({ ...base, status: 'connected', latest: sample(99_000, 81, 'poor') })).toMatchObject({ state: 'poorContact' })
  })

  it('rPPG 값이 있으면 rPPG − 워치 차이를 함께 보인다', () => {
    expect(watchView({ ...base, status: 'connected', latest: sample(99_000), rppgBpm: 84 }).text).toBe('81 BPM · rPPG 차이 +3')
    expect(watchView({ ...base, status: 'connected', latest: sample(99_000), rppgBpm: 79 }).text).toBe('81 BPM · rPPG 차이 −2')
  })

  it('끝난 이유(끊김·못 찾음·실패)를 구분해 보이고 다시 연결할 수 있다', () => {
    expect(watchView({ ...base, failure: 'disconnected' })).toMatchObject({ state: 'disconnected', action: 'connect' })
    expect(watchView({ ...base, failure: 'notFound' })).toMatchObject({ state: 'notFound', action: 'connect' })
    expect(watchView({ ...base, failure: 'failed' })).toMatchObject({ state: 'failed', action: 'connect' })
  })
})

describe('pulseOrigin', () => {
  it('측정 중 워치가 대표 심박이면 파형도 워치 BPM 리듬을 쓴다', () => {
    expect(pulseOrigin(true, 'watch')).toBe('watch')
  })

  it('워치가 대표값이 아니거나 측정 전이면 rPPG 파형을 쓴다', () => {
    expect(pulseOrigin(true, 'rppg')).toBe('rppg')
    expect(pulseOrigin(true, null)).toBe('rppg')
    expect(pulseOrigin(false, 'watch')).toBe('rppg')
  })
})
