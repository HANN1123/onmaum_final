'use client'

import { useSyncExternalStore } from 'react'
import type { OnmaumDesktopApi } from '@/features/electron/types/bridge'

declare global {
  interface Window {
    /** Electron preload가 노출하는 bridge. 웹에서는 없다. */
    onmaumDesktop?: OnmaumDesktopApi
  }
}

/** Electron 앱이면 bridge, 웹이면 null */
export function getDesktopBridge(): OnmaumDesktopApi | null {
  if (typeof window === 'undefined') return null
  return window.onmaumDesktop ?? null
}

const subscribe = () => () => {}

/**
 * bridge는 실행 중에 바뀌지 않는다. 서버 렌더와 첫 렌더는 웹과 같게(null) 두고
 * hydration 뒤에 실제 값을 쓴다(hydration 불일치 방지).
 */
export function useDesktopBridge(): OnmaumDesktopApi | null {
  return useSyncExternalStore(subscribe, getDesktopBridge, () => null)
}
