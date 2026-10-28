/**
 * Electron main·preload·renderer가 함께 쓰는 bridge 계약.
 * Electron·Node·DOM 런타임에 의존하지 않는다(타입과 상수만).
 */

/** 감정 분포. `features/algorithm/emotion/emotionAnalysis.ts`의 EmotionResult와 같은 모양. */
export interface DesktopEmotion {
  happy: number
  calm: number
  sad: number
  angry: number
}

/** 측정 화면이 메인 프로세스로 보내는 측정 상태. */
export interface MeasurementSnapshot {
  /** 측정 중 여부 (/measure의 active) */
  active: boolean
  /** 현재 감정. 얼굴을 못 찾았거나 측정 전이면 null */
  emotions: DesktopEmotion | null
  /** 누적 기록 수 (오브 성장 단계) */
  recordCount: number
  /** 최근 1초 동안 디코딩된 카메라 프레임 수(진단). 알 수 없으면 null */
  videoFps: number | null
  /** 보낸 시각(ms) */
  sentAt: number
}

/** 메인 프로세스가 위젯에 넘기는 상태. */
export interface WidgetView {
  /** 메인 프로세스가 붙이는 증가 순번. 위젯은 더 작은 순번을 버린다 */
  seq: number
  snapshot: MeasurementSnapshot | null
  /** 마지막 스냅샷을 받은 시각(ms, 메인 프로세스 기준) */
  receivedAt: number | null
  /** 측정 중 videoFps가 0 또는 null로 이어지기 시작한 시각. 프레임이 들어오면 null */
  noFramesSince: number | null
  /** 최소화된 동안 측정이 끝났는지 */
  endedWhileMinimized: boolean
}

export interface WidgetPosition {
  x: number
  y: number
}

export interface DesktopSettings {
  widget: {
    enabled: boolean
    position: WidgetPosition | null
  }
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  widget: { enabled: true, position: null },
}

/** preload가 `window.onmaumDesktop`으로 노출하는 API. */
export interface OnmaumDesktopApi {
  readonly version: string
  readonly platform: string
  readonly capabilities: { readonly widget: boolean }
  /** 메인 창 전용: 측정 상태를 보낸다 */
  publishMeasurement(snapshot: MeasurementSnapshot): void
  /** 위젯 전용: 현재 상태를 받는다 */
  getMeasurement(): Promise<WidgetView>
  /** 위젯 전용: 상태 변화를 구독한다. 해제 함수를 돌려준다 */
  onMeasurement(listener: (view: WidgetView) => void): () => void
  /** 위젯 전용: 메인 창을 복원한다 */
  openMainWindow(): void
  /** 메인 창 전용 */
  getDesktopSettings(): Promise<DesktopSettings>
  /** 메인 창 전용: 위젯 표시 설정을 바꾸고 바뀐 설정을 돌려준다 */
  setWidgetEnabled(enabled: boolean): Promise<DesktopSettings>
}

/**
 * IPC 채널 이름. preload는 샌드박스 단일 파일이라 이 모듈을 import하지 못하고
 * 같은 문자열을 직접 쓴다. 두 쪽이 같은지는 tests/electron/channels.test.ts가 확인한다.
 */
export const CHANNELS = {
  publishMeasurement: 'onmaum:measurement:publish',
  getMeasurement: 'onmaum:measurement:get',
  measurementUpdate: 'onmaum:measurement:update',
  openMainWindow: 'onmaum:widget:open-main',
  getSettings: 'onmaum:settings:get',
  setWidgetEnabled: 'onmaum:settings:set-widget-enabled',
} as const

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]

/** IPC를 보낸 창의 역할 */
export type WindowRole = 'main' | 'widget' | 'unknown'
