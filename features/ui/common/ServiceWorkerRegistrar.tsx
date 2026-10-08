'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!('serviceWorker' in navigator)) return

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
