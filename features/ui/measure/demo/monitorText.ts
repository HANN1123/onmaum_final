import { RPPG_STATUS_TEXT, type RppgReading } from '@/features/rppg/engine/rppgGate'
import type { StorageConsent } from '@/shared/storage/consent'
import type { RecorderStatus } from './measureRecorder'
import type { WatchState } from './watchStatus'

/**
 * 측정 화면 "모니터링 Info" 칸의 행 글(2026-11-20 교수님 피드백·스케치).
 * 측정 시간 · 심박 신호 품질 · 얼굴 검출률 · 심박 측정 방식 · 기록 여부 다섯 줄만 남기고, 각 줄은 짧은 값만 보인다.
 */

/** 심박 신호 품질: rPPG SNR 과, 워치가 정상으로 들어오면 같은 순간 rPPG 와의 bpm 차이. SNR 이 없으면 엔진 상태 */
export function signalQualityText(
  webcamReady: boolean,
  reading: RppgReading,
  watchBpm: number | null,
  rppgBpm: number | null,
): string {
  if (!webcamReady) return '카메라 대기'
  const snr = reading.snrDb !== null && reading.status !== 'off' ? `SNR ${reading.snrDb.toFixed(1)} dB` : RPPG_STATUS_TEXT[reading.status]
  if (watchBpm === null || rppgBpm === null) return snr
  const d = Math.round(rppgBpm) - Math.round(watchBpm)
  return `${snr} · 워치 차이 ${d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '0'} bpm`
}

/** 얼굴 검출률: 최근 10초 엔진 프레임 기준 백분율만 */
export function faceRateText(webcamReady: boolean, rate: number | null): string {
  if (!webcamReady) return '카메라 대기'
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

/** 심박 측정 방식: 지금 대표 심박의 출처. 워치를 연결하는 중이거나 문제가 있으면 짧게 덧붙인다 */
export function heartSourceText(active: boolean, source: 'watch' | 'rppg' | null, watchState: WatchState): string {
  const base = !active ? '—' : source === 'watch' ? '워치' : source === 'rppg' ? 'rPPG' : '—'
  const note = WATCH_NOTE[watchState]
  return note && source !== 'watch' ? `${base} · ${note}` : base
}

const WATCH_NOTE: Partial<Record<WatchState, string>> = {
  connecting: '워치 연결 중',
  waiting: '워치 첫 값 대기',
  stale: '워치 신호 없음',
  poorContact: '워치 착용 확인',
  disconnected: '워치 연결 끊김',
  notFound: '워치 못 찾음',
  failed: '워치 연결 실패',
}

/** 기록 여부: 저장하지 않는 동안은 대기 중, 측정하며 저장하는 동안은 저장 중. 저장 실패는 숨기지 않는다 */
export function recordStateText(
  consent: StorageConsent | null | undefined,
  active: boolean,
  status: RecorderStatus | null,
): string {
  if (consent === undefined) return '확인 중'
  if (!consent?.record || !active) return '대기 중'
  return status?.failed ? '저장 실패' : '저장 중'
}
