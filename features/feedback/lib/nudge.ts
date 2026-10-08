import type { StressLevel } from '../../algorithm/baseline/baseline'

export interface NudgeSettings {
  enabled: boolean
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
}

export function updateSustain(
  prev: SustainState | null,
  level: StressLevel,
  nowMs: number,
): SustainState {
  const isHigh = level === 'high' || level === 'veryHigh'
  if (!isHigh) return { level, highSinceMs: null }
  return { level, highSinceMs: prev?.highSinceMs ?? nowMs }
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
