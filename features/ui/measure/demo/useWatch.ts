import { useEffect, useState } from 'react'
import { useHeartRateDevice } from '@/features/rppg/hooks/useHeartRateDevice'
import { watchView, type WatchView } from './watchStatus'

/**
 * 측정 화면의 워치 연동(기준 심박). 실험실의 Web Bluetooth 훅을 그대로 쓰고,
 * 새 값이 오지 않아도 "신호 없음(5초)"을 판정할 수 있게 1초마다 다시 계산한다.
 * 연결은 사용자가 버튼을 눌렀을 때만 한다(자동 재연결 없음). 화면을 떠나면 훅이 연결을 끊는다.
 */
export function useWatch(rppgBpm: number | null): WatchView & { connect: () => void; disconnect: () => void } {
  const device = useHeartRateDevice()
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (device.status !== 'connected') return
    const id = setInterval(() => setNow(performance.now()), 1000)
    return () => clearInterval(id)
  }, [device.status])

  const view = watchView({
    supported: device.supported,
    status: device.status,
    latest: device.latest,
    failure: device.failure,
    // 새 값을 받으면 그 시각으로, 아니면 1초 타이머 시각으로 신선도를 본다
    now: Math.max(now, device.latest?.t ?? 0),
    rppgBpm,
  })
  return { ...view, connect: () => void device.connect(), disconnect: device.disconnect }
}
