import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotificationPermission } from '@/hooks/nudge/useNotificationPermission'

const originalNotification = globalThis.Notification

interface NotificationMock {
  permission: NotificationPermission
  requestPermission: ReturnType<typeof vi.fn>
}

function setupNotificationMock(
  initialPermission: NotificationPermission,
  requestResult: NotificationPermission,
): NotificationMock {
  const mock: NotificationMock = {
    permission: initialPermission,
    requestPermission: vi.fn().mockResolvedValue(requestResult),
  }
  vi.stubGlobal('Notification', mock)
  return mock
}

describe('useNotificationPermission', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalNotification) {
      vi.stubGlobal('Notification', originalNotification)
    }
  })

  it('Notification API 미지원 환경 → supported=false, permission="unsupported"', () => {
    vi.stubGlobal('Notification', undefined)
    const { result } = renderHook(() => useNotificationPermission())
    expect(result.current.supported).toBe(false)
    expect(result.current.permission).toBe('unsupported')
  })

  it('초기 permission이 default → permission="default"', () => {
    setupNotificationMock('default', 'granted')
    const { result } = renderHook(() => useNotificationPermission())
    expect(result.current.supported).toBe(true)
    expect(result.current.permission).toBe('default')
  })

  it('초기 permission이 granted → permission="granted"', () => {
    setupNotificationMock('granted', 'granted')
    const { result } = renderHook(() => useNotificationPermission())
    expect(result.current.permission).toBe('granted')
  })

  it('request() 호출 → Notification.requestPermission 호출 + permission 갱신', async () => {
    const mock = setupNotificationMock('default', 'granted')
    const { result } = renderHook(() => useNotificationPermission())

    await act(async () => {
      await result.current.request()
    })

    expect(mock.requestPermission).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(result.current.permission).toBe('granted')
    })
  })

  it('request() 시 사용자가 거부 → permission="denied"', async () => {
    setupNotificationMock('default', 'denied')
    const { result } = renderHook(() => useNotificationPermission())

    await act(async () => {
      await result.current.request()
    })

    await waitFor(() => {
      expect(result.current.permission).toBe('denied')
    })
  })

  it('미지원 환경에서 request() 호출 → 아무 일 없음 (supported=false)', async () => {
    vi.stubGlobal('Notification', undefined)
    const { result } = renderHook(() => useNotificationPermission())

    await act(async () => {
      await result.current.request()
    })

    expect(result.current.supported).toBe(false)
    expect(result.current.permission).toBe('unsupported')
  })
})
