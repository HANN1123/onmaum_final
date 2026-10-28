/** 위젯 상태 문구 판정. 메인 프로세스와 위젯 화면이 같이 쓰는 순수 함수. */
import type { WidgetView } from './bridge'

export type WidgetStatus = 'measuring' | 'attention' | 'stopped'

/** 측정 중인데 이 시간 넘게 스냅샷이 없으면 "확인 필요" */
export const HEARTBEAT_STALE_MS = 5000
/** 측정 중인데 카메라 프레임이 이 시간 넘게 0(또는 알 수 없음)이면 "확인 필요" */
export const NO_FRAMES_ATTENTION_MS = 5000

export function widgetStatus(view: WidgetView, now: number): WidgetStatus {
  const snap = view.snapshot
  if (!snap?.active) return 'stopped'
  if (view.receivedAt === null || now - view.receivedAt > HEARTBEAT_STALE_MS) return 'attention'
  if (view.noFramesSince !== null && now - view.noFramesSince >= NO_FRAMES_ATTENTION_MS) return 'attention'
  return 'measuring'
}
