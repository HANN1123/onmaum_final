import type { CheckinWindow } from '../../features/feedback/lib/checkin'
import type { NudgeSettings } from '../../features/feedback/lib/nudge'

export const SETTINGS_KEY = 'onmaum_settings'

export interface Settings {
  nudge: NudgeSettings
  morningWindow: CheckinWindow
  afternoonWindow: CheckinWindow
  calibrationOffset: number
}

export const DEFAULT_SETTINGS: Settings = {
  nudge: {
    enabled: false,
    maxPerDay: 2,
    cooldownMs: 90 * 60 * 1000,
    sustainMs: 5 * 60 * 1000,
    dndStartHour: null,
    dndEndHour: null,
  },
  morningWindow: { startHour: 10, endHour: 12 },
  afternoonWindow: { startHour: 15, endHour: 17 },
  calibrationOffset: 0,
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const p = JSON.parse(raw) as Partial<Settings>
    return {
      nudge: { ...DEFAULT_SETTINGS.nudge, ...(p.nudge ?? {}) },
      morningWindow: { ...DEFAULT_SETTINGS.morningWindow, ...(p.morningWindow ?? {}) },
      afternoonWindow: { ...DEFAULT_SETTINGS.afternoonWindow, ...(p.afternoonWindow ?? {}) },
      calibrationOffset:
        typeof p.calibrationOffset === 'number' ? p.calibrationOffset : 0,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // 저장 불가 환경은 조용히 무시 (서버 폴백 없음)
  }
}
