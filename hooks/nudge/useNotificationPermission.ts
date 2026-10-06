'use client'

import { useCallback, useEffect, useState } from 'react'

export type PermissionState = NotificationPermission | 'unsupported'

interface Result {
  supported: boolean
  permission: PermissionState
  request: () => Promise<void>
}

function readPermission(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

export function useNotificationPermission(): Result {
  // 서버/첫 클라이언트 렌더를 'unsupported'로 일치시켜 hydration mismatch 방지.
  // 실제 권한은 mount 후 effect에서 로드한다.
  const [permission, setPermission] = useState<PermissionState>('unsupported')

  // 첫 마운트 시 클라이언트 환경 권한 다시 체크 (SSR hydration 호환). 한 번만 호출, cascading 아님.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(readPermission())
  }, [])

  const request = useCallback(async (): Promise<void> => {
    if (typeof Notification === 'undefined') return
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } catch (err) {
      console.error('Notification.requestPermission 실패:', err)
    }
  }, [])

  const supported = permission !== 'unsupported'

  return { supported, permission, request }
}
