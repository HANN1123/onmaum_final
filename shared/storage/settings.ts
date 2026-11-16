import type { CheckinSlot, CheckinWindow } from '../../features/feedback/lib/checkin'
import type { NudgeSettings } from '../../features/feedback/lib/nudge'

export const SETTINGS_KEY = 'onmaum_settings'

export interface Settings {
  nudge: NudgeSettings
  morningWindow: CheckinWindow
  afternoonWindow: CheckinWindow
  /** 체크인을 물을 시간대. 끈 시간대는 묻지 않는다(처음 설문·기록 화면에서 고른다) */
  checkinSlots: Record<CheckinSlot, boolean>
  calibrationOffset: number
}

export const DEFAULT_SETTINGS: Settings = {
  nudge: {
    enabled: false,
    osNotify: true,
    maxPerDay: 2,
    cooldownMs: 90 * 60 * 1000,
    sustainMs: 5 * 60 * 1000,
    dndStartHour: null,
    dndEndHour: null,
  },
  morningWindow: { startHour: 10, endHour: 12 },
  afternoonWindow: { startHour: 15, endHour: 17 },
  checkinSlots: { morning: true, afternoon: true },
  calibrationOffset: 0,
}

/** 설정이 바뀌면 같은 탭의 화면이 다시 읽도록 보내는 이벤트(다른 탭은 storage 이벤트로 안다) */
export const SETTINGS_CHANGED_EVENT = 'onmaum:settings-changed'

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
      checkinSlots: {
        morning: typeof p.checkinSlots?.morning === 'boolean' ? p.checkinSlots.morning : true,
        afternoon: typeof p.checkinSlots?.afternoon === 'boolean' ? p.checkinSlots.afternoon : true,
      },
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
    window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT))
  } catch {
    // 저장 불가 환경은 조용히 무시 (서버 폴백 없음)
  }
}
