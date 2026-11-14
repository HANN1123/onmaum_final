import type { StressLevel } from '../../algorithm/baseline/baseline'

export interface NudgeSettings {
  enabled: boolean
  /**
   * 화면 안 배너와 함께 OS(윈도우) 알림도 띄울지. 권한이 있어도 이 값이 false 면 띄우지 않는다.
   * 이전 설정에는 없던 값이라, 없으면 이전 동작(권한이 있으면 띄움)과 같게 true 로 읽는다.
   */
  osNotify: boolean
  maxPerDay: number
  cooldownMs: number
  sustainMs: number
  dndStartHour: number | null
  dndEndHour: number | null
}

export interface NudgeDayState {
  count: number
  lastAtMs: number | null
}

export interface SustainState {
  level: StressLevel
  highSinceMs: number | null
  /** 마지막으로 평가한 시각. 측정 공백 판별용 */
  lastEvalMs?: number
}

/**
 * 평가는 감정 레코드 저장(측정 중 약 1분 주기)마다 일어난다.
 * 직전 평가와의 간격이 이 값을 넘으면 측정이 끊겼던 것으로 보고 "높음 지속"을 새로 센다.
 * 1분 집계 주기의 2배다. 저장이 몇 초 늦어지는 것은 허용하지만, 1분 구간 전체에서
 * 얼굴이 검출되지 않아 저장이 한 번 빠지면(간격 약 2분 이상) 지속 근거가 없으므로 새로 센다.
 */
export const MAX_EVAL_GAP_MS = 2 * 60 * 1000

export function updateSustain(
  prev: SustainState | null,
  level: StressLevel,
  nowMs: number,
): SustainState {
  const isHigh = level === 'high' || level === 'veryHigh'
  if (!isHigh) return { level, highSinceMs: null, lastEvalMs: nowMs }
  const gapped = prev?.lastEvalMs !== undefined && nowMs - prev.lastEvalMs > MAX_EVAL_GAP_MS
  const highSinceMs = gapped ? nowMs : (prev?.highSinceMs ?? nowMs)
  return { level, highSinceMs, lastEvalMs: nowMs }
}

function inDnd(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

export function shouldNudge(args: {
  settings: NudgeSettings
  sustain: SustainState
  dayState: NudgeDayState
  now: Date
}): boolean {
  const { settings, sustain, dayState, now } = args
  if (!settings.enabled) return false
  if (sustain.highSinceMs === null) return false
  if (now.getTime() - sustain.highSinceMs < settings.sustainMs) return false
  if (inDnd(now.getHours(), settings.dndStartHour, settings.dndEndHour)) return false
  if (dayState.count >= settings.maxPerDay) return false
  if (dayState.lastAtMs !== null && now.getTime() - dayState.lastAtMs < settings.cooldownMs) {
    return false
  }
  return true
}
