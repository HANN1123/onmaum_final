/**
 * 위젯 상태 문구 판정. 메인 프로세스와 위젯 화면이 같이 쓰는 순수 함수.
 * "측정 중"은 화면 생존·카메라 프레임·감정 결과·저장 실패 여부만 본다. 저장 성공까지 확인하지는 않는다.
 */
import type { WidgetView } from './bridge'

export type WidgetStatus = 'measuring' | 'attention' | 'stopped'

/** 측정 중인데 이 시간 넘게 스냅샷이 없으면 "확인 필요" */
export const HEARTBEAT_STALE_MS = 5000
/** 측정 중인데 카메라 프레임이 이 시간 넘게 0(또는 알 수 없음)이면 "확인 필요" */
export const NO_FRAMES_ATTENTION_MS = 5000
/**
 * 측정 중인데 감정 결과가 이 시간 넘게 없으면(얼굴 미검출·분석 실패) "확인 필요".
 * 그동안은 기록이 쌓이지 않는다. 고개를 잠깐 돌리는 정도는 넘기도록 프레임 기준보다 길게 둔다.
 */
export const NO_EMOTION_ATTENTION_MS = 30_000

export function widgetStatus(view: WidgetView, now: number): WidgetStatus {
  const snap = view.snapshot
  if (!snap?.active) return 'stopped'
  if (view.receivedAt === null || now - view.receivedAt > HEARTBEAT_STALE_MS) return 'attention'
  if (view.noFramesSince !== null && now - view.noFramesSince >= NO_FRAMES_ATTENTION_MS) return 'attention'
  if (snap.saveFailed) return 'attention'
  if (view.noEmotionSince !== null && now - view.noEmotionSince >= NO_EMOTION_ATTENTION_MS) return 'attention'
  return 'measuring'
}
