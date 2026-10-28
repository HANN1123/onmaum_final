import { vi } from 'vitest'
import {
  DEFAULT_DESKTOP_SETTINGS,
  type DesktopSettings,
  type OnmaumDesktopApi,
  type WidgetView,
} from '@/features/electron/types/bridge'

/** 테스트용 가짜 bridge. listeners로 메인 프로세스 알림을 흉내 낸다. */
export function createFakeBridge(initialView?: WidgetView) {
  const listeners = new Set<(v: WidgetView) => void>()
  let settings: DesktopSettings = { widget: { ...DEFAULT_DESKTOP_SETTINGS.widget } }
  const bridge = {
    version: '45.1.0',
    platform: 'win32',
    capabilities: { widget: true },
    publishMeasurement: vi.fn(),
    getMeasurement: vi.fn(async () => initialView ?? emptyView()),
    onMeasurement: vi.fn((l: (v: WidgetView) => void) => {
      listeners.add(l)
      return () => listeners.delete(l)
    }),
    openMainWindow: vi.fn(),
    getDesktopSettings: vi.fn(async () => settings),
    setWidgetEnabled: vi.fn(async (enabled: boolean) => {
      settings = { widget: { ...settings.widget, enabled } }
      return settings
    }),
  } satisfies OnmaumDesktopApi
  return {
    bridge,
    emit: (v: WidgetView) => listeners.forEach((l) => l(v)),
    install: () => {
      window.onmaumDesktop = bridge
    },
  }
}

export function emptyView(): WidgetView {
  return { seq: 0, snapshot: null, receivedAt: null, noFramesSince: null, endedWhileMinimized: false }
}

export function uninstallBridge() {
  delete window.onmaumDesktop
}
