import type { RppgQuality } from '../engine/rppgGate'

/** 실측 알림 간격이 5초를 9회 넘고 최대 6.06초여서 행과 선택기 모두 8초를 쓴다. */
export const WATCH_STALE_MS = 8_000
export type HeartRateOrigin = 'watch' | 'rppg'
export interface WatchSample {
  /** performance.now() 기준 수신 시각(ms) */
  t: number
  bpm: number
  contact: 'good' | 'poor' | 'unsupported'
}
export type WatchConnectionStatus = 'idle' | 'connecting' | 'connected'

export function isWatchBpmValid(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= 30 && bpm <= 220
}

export function isWatchFresh(latest: WatchSample, now: number, staleMs = WATCH_STALE_MS): boolean {
  const age = now - latest.t
  return Number.isFinite(latest.t) && Number.isFinite(now) && age >= 0 && age <= staleMs
}

export interface HeartRateSelectionState {
  source: HeartRateOrigin | null
  lastWatchT: number | null
}
export function initialHeartRateSelectionState(): HeartRateSelectionState {
  return { source: null, lastWatchT: null }
}

/**
 * 정상 알림 한 번으로 복귀한다. 8초 신선도 자체가 무수신 유예이므로 추가 확인·보간은 없다.
 * 상태는 관측용이며 누적 확인 횟수는 없다. 같은 표본 재평가로 수신 횟수가 늘지 않는다.
 * 호출자는 렌더 중 상태를 갱신할 필요가 없고, 시작·재연결 때 초기 상태로 평가할 수 있다.
 */
export function selectHeartRate(input: {
  latest: WatchSample | null
  status: WatchConnectionStatus
  now: number
  rppgBpm: number | null
  rppgQuality: RppgQuality | null
}, previous = initialHeartRateSelectionState()) {
  const { latest, status, now, rppgBpm, rppgQuality } = input
  const available = status === 'connected' && latest !== null && isWatchFresh(latest, now)
    && latest.contact !== 'poor' && isWatchBpmValid(latest.bpm)
  const cameraBpm = rppgBpm !== null && Number.isFinite(rppgBpm) ? rppgBpm : null
  const bpm = available ? latest.bpm : cameraBpm
  const source: HeartRateOrigin | null = available ? 'watch' : cameraBpm !== null ? 'rppg' : null
  return {
    bpm, source, rppgQuality,
    state: { source, lastWatchT: status !== 'connected' ? null : latest?.t ?? previous.lastWatchT },
  }
}

/** 출처 없는 옛 표본은 유효한 심박이 있을 때만 카메라로 읽는다. */
export function bpmOrigin(sample: { bpm: number | null; source?: HeartRateOrigin }): HeartRateOrigin | null {
  return sample.bpm !== null && Number.isFinite(sample.bpm) ? sample.source ?? 'rppg' : null
}
