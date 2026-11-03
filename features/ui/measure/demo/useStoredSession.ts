import { useMemo, useSyncExternalStore } from 'react'
import { parseDemoSession, readDemoSessionRaw, type DemoSession } from './sessionLog'

/** 같은 탭 안에서는 바뀌지 않으므로 구독할 것이 없다. */
const subscribe = () => () => {}
const serverSnapshot = () => null

/**
 * 측정 화면이 sessionStorage 에 남긴 지난 측정. 서버와 하이드레이션 중에는 null 이라
 * 화면이 어긋나지 않고, 그 뒤 한 번 다시 그려 실제 값을 쓴다.
 */
export function useStoredSession(): DemoSession | null {
  const raw = useSyncExternalStore(subscribe, readDemoSessionRaw, serverSnapshot)
  return useMemo(() => parseDemoSession(raw), [raw])
}
