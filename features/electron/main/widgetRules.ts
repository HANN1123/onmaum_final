/**
 * 위젯 표시 규칙과 측정 상태 보관. electron을 import하지 않는 순수 모듈.
 *
 * 보이는 조건: 설정 켬 + 메인 창 최소화 + (측정 중 또는 이번 최소화 동안 측정이 끝남)
 */
import type { MeasurementSnapshot, WidgetPosition, WidgetView } from '../types/bridge'

export interface WidgetState {
  enabled: boolean
  mainMinimized: boolean
  view: WidgetView
}

export type WidgetEvent =
  | { type: 'minimize' }
  | { type: 'restore' }
  | { type: 'setEnabled'; enabled: boolean }
  | { type: 'snapshot'; snapshot: MeasurementSnapshot; now: number }
  /** 측정 화면이 사라짐(새로고침·문서 이동·renderer 종료) */
  | { type: 'measurementLost'; now: number }

export function initialWidgetState(enabled: boolean): WidgetState {
  return {
    enabled,
    mainMinimized: false,
    view: {
      seq: 0,
      snapshot: null,
      receivedAt: null,
      noFramesSince: null,
      endedWhileMinimized: false,
    },
  }
}

function withView(state: WidgetState, view: Omit<WidgetView, 'seq'>): WidgetState {
  return { ...state, view: { ...view, seq: state.view.seq + 1 } }
}

function applySnapshot(state: WidgetState, snapshot: MeasurementSnapshot, now: number): WidgetState {
  const wasActive = state.view.snapshot?.active === true
  const endedNow = wasActive && !snapshot.active && state.mainMinimized

  // 측정 중인데 프레임이 0이거나 알 수 없으면 그때부터 시각을 잰다.
  const noFrames = snapshot.active && (snapshot.videoFps === null || snapshot.videoFps === 0)
  const noFramesSince = noFrames ? (state.view.noFramesSince ?? now) : null

  return withView(state, {
    snapshot,
    receivedAt: now,
    noFramesSince,
    endedWhileMinimized: state.view.endedWhileMinimized || endedNow,
  })
}

export function reduceWidgetState(state: WidgetState, event: WidgetEvent): WidgetState {
  switch (event.type) {
    case 'minimize':
    case 'restore':
      // 최소화 구간마다 "측정 끝남" 기억을 새로 시작한다.
      return withView(
        { ...state, mainMinimized: event.type === 'minimize' },
        { ...state.view, endedWhileMinimized: false },
      )
    case 'setEnabled':
      return { ...state, enabled: event.enabled }
    case 'snapshot':
      return applySnapshot(state, event.snapshot, event.now)
    case 'measurementLost': {
      const prev = state.view.snapshot
      if (!prev?.active) return state
      return applySnapshot(
        state,
        { ...prev, active: false, emotions: null, videoFps: null, sentAt: event.now },
        event.now,
      )
    }
  }
}

export function shouldShowWidget(state: WidgetState): boolean {
  if (!state.enabled || !state.mainMinimized) return false
  return state.view.snapshot?.active === true || state.view.endedWhileMinimized
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const WIDGET_SIZE = { width: 180, height: 220 } as const
export const WIDGET_MARGIN = 24

function contains(area: Rect, r: Rect): boolean {
  return (
    r.x >= area.x &&
    r.y >= area.y &&
    r.x + r.width <= area.x + area.width &&
    r.y + r.height <= area.y + area.height
  )
}

/**
 * 저장된 위치에 놓았을 때 위젯 전체 영역이 어느 모니터 작업 영역에 완전히 들어가면
 * 그대로 쓰고, 아니면 주 모니터 작업 영역 오른쪽 아래로 되돌린다.
 */
export function resolveWidgetPosition(
  saved: WidgetPosition | null,
  workAreas: readonly Rect[],
  primaryWorkArea: Rect,
  size: { width: number; height: number } = WIDGET_SIZE,
): WidgetPosition {
  if (saved) {
    const rect = { ...saved, ...size }
    if (workAreas.some((area) => contains(area, rect))) return { x: saved.x, y: saved.y }
  }
  return {
    x: primaryWorkArea.x + primaryWorkArea.width - size.width - WIDGET_MARGIN,
    y: primaryWorkArea.y + primaryWorkArea.height - size.height - WIDGET_MARGIN,
  }
}
