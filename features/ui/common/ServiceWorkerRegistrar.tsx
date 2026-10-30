'use client'

import { useEffect } from 'react'
import { getDesktopBridge } from '@/features/electron/renderer/desktopBridge'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // Electron 앱은 파일을 앱 안에서 직접 제공하므로 서비스 워커 캐시를 쓰지 않는다
    if (getDesktopBridge()) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker 등록 완료:', registration.scope)
      })
      .catch((err) => {
        console.error('❌ Service Worker 등록 실패:', err)
      })
  }, [])

  return null
}
