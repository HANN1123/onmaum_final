/**
 * 데스크톱 전용 설정(`userData/desktop-settings.json`) 파싱.
 * 웹 저장소(onmaum_settings, Dexie)와 별개다. electron을 import하지 않는 순수 모듈.
 */
import { DEFAULT_DESKTOP_SETTINGS, type DesktopSettings, type WidgetPosition } from '../types/bridge'

export const DESKTOP_SETTINGS_FILE = 'desktop-settings.json'

function parsePosition(v: unknown): WidgetPosition | null {
  if (typeof v !== 'object' || v === null) return null
  const { x, y } = v as Record<string, unknown>
  if (typeof x !== 'number' || typeof y !== 'number') return null
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x: Math.round(x), y: Math.round(y) }
}

/** 파일 내용(없으면 null)을 설정으로 바꾼다. 깨졌거나 모양이 다르면 기본값으로 채운다. */
export function parseDesktopSettings(raw: string | null): DesktopSettings {
  const fallback: DesktopSettings = {
    widget: { ...DEFAULT_DESKTOP_SETTINGS.widget },
  }
  if (raw === null) return fallback
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return fallback
  }
  if (typeof data !== 'object' || data === null) return fallback
  const widget = (data as Record<string, unknown>).widget
  if (typeof widget !== 'object' || widget === null) return fallback
  const w = widget as Record<string, unknown>
  return {
    widget: {
      enabled: typeof w.enabled === 'boolean' ? w.enabled : fallback.widget.enabled,
      position: parsePosition(w.position),
    },
  }
}

export function serializeDesktopSettings(settings: DesktopSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`
}
