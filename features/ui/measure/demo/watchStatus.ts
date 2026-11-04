import type { HeartRateFailure } from '@/features/rppg/hooks/useHeartRateDevice'

/**
 * 측정 화면 "워치" 행의 상태 판정(순수 함수).
 * 워치 값은 기준 심박이다. 화면의 rPPG BPM 을 대신하지 않고 이 행에서만 보인다.
 * 우선순위: 지원 안 함 → 연결 중 → (연결됨) 첫 값 대기 → 신호 없음(5초) → 접촉 불량 → 측정 중 → (연결 안 됨) 끊김·못 찾음·실패 → 연결 안 됨
 */
export const WATCH_STALE_MS = 5_000

export type WatchState =
  | 'unsupported'
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'stale'
  | 'poorContact'
  | 'live'
  | 'disconnected'
  | 'notFound'
  | 'failed'

export interface WatchInput {
  supported: boolean
  status: 'idle' | 'connecting' | 'connected'
  /** 마지막 값. t 는 performance.now() 수신 시각 */
  latest: { t: number; bpm: number; contact: 'good' | 'poor' | 'unsupported' } | null
  failure: HeartRateFailure | null
  /** performance.now() */
  now: number
  /** 같은 순간의 rPPG BPM(게이트 통과 시). 차이 표시용 */
  rppgBpm: number | null
}

export interface WatchView {
  state: WatchState
  /** 행 오른쪽 글 */
  text: string
  /** 연결 버튼 종류. null 이면 버튼 없음 */
  action: 'connect' | 'disconnect' | null
}

export function watchView(input: WatchInput): WatchView {
  const { supported, status, latest, failure, now, rppgBpm } = input
  if (!supported) return { state: 'unsupported', text: '이 환경에서 지원 안 함', action: null }
  if (status === 'connecting') return { state: 'connecting', text: '연결 중…', action: null }
  if (status === 'connected') {
    if (!latest) return { state: 'waiting', text: '연결됨 · 첫 값 기다리는 중', action: 'disconnect' }
    if (now - latest.t > WATCH_STALE_MS) return { state: 'stale', text: '신호 없음 · 워치에서 시작했는지 확인', action: 'disconnect' }
    if (latest.contact === 'poor') return { state: 'poorContact', text: '연결됨 · 착용 상태 확인', action: 'disconnect' }
    const bpm = Math.round(latest.bpm)
    const diff = rppgBpm === null ? '' : ` · rPPG 차이 ${formatDiff(Math.round(rppgBpm) - bpm)}`
    return { state: 'live', text: `${bpm} BPM${diff}`, action: 'disconnect' }
  }
  if (failure === 'disconnected') return { state: 'disconnected', text: '연결 끊김', action: 'connect' }
  if (failure === 'notFound') return { state: 'notFound', text: '찾지 못함 · 하나만 켜고 다시', action: 'connect' }
  if (failure === 'failed') return { state: 'failed', text: '연결 실패', action: 'connect' }
  return { state: 'idle', text: '연결 안 됨', action: 'connect' }
}

function formatDiff(d: number): string {
  return d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '0'
}

/** 연결 안내(버튼 title). HeartCast 장치 이름은 환경마다 다를 수 있어 이름으로 안내하지 않는다 */
export const WATCH_HINT =
  'iPhone과 Apple Watch에서 HeartCast를 열고 워치에서 시작을 누른 뒤 연결하세요. 처음 연결하는 동안 iPhone의 HeartCast를 화면에 켜 두세요.'
