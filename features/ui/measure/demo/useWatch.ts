import { useLayoutEffect, useState } from 'react'
import { useHeartRateDevice } from '@/features/rppg/hooks/useHeartRateDevice'
import { WATCH_STALE_MS } from '@/features/rppg/lib/heartRateSource'
import { watchView } from './watchStatus'

/**
 * 측정 화면의 워치 연동(기준 심박). 실험실의 Web Bluetooth 훅을 그대로 쓰고,
 * 행과 표시 선택기에 같은 원천·시각을 제공하며 만료 직후에도 다시 계산한다.
 * 연결은 사용자가 버튼을 눌렀을 때만 한다(자동 재연결 없음). 화면을 떠나면 훅이 연결을 끊는다.
 */
export function useWatch(rppgBpm: number | null) {
  const device = useHeartRateDevice()
  const [now, setNow] = useState(0)

  useLayoutEffect(() => {
    // 외부 단조 시계의 스냅샷을 알림 직후 동기화한다. 렌더 중 시계를 읽거나 상태를 바꾸지 않는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(performance.now())
    if (device.status !== 'connected') return
    const update = () => setNow(performance.now())
    const id = setInterval(update, 1000)
    const remaining = device.latest ? device.latest.t + WATCH_STALE_MS - performance.now() : -1
    // 정확히 8초까지 유효하다. 다음 1ms에 별도로 깨워 만료가 1초 늦어지지 않게 한다.
    const expiry = Number.isFinite(remaining) && remaining >= 0 ? setTimeout(update, remaining + 1) : null
    return () => { clearInterval(id); if (expiry !== null) clearTimeout(expiry) }
  }, [device.status, device.latest])

  const view = watchView({
    supported: device.supported,
    status: device.status,
    latest: device.latest,
    failure: device.failure,
    now,
    rppgBpm,
  })
  return { ...view, latest: device.latest, status: device.status, now, connect: () => void device.connect(), disconnect: device.disconnect }
}
