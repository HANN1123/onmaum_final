/** 실행 모드별 URL·저장소 분리. electron을 import하지 않는 순수 모듈. */

export const APP_SCHEME = 'app'
export const APP_HOST = 'onmaum'
export const APP_ORIGIN_URL = `${APP_SCHEME}://${APP_HOST}/`
export const DEV_PORT = 3003
export const DEV_URL = `http://localhost:${DEV_PORT}/`
// 시연용 빌드(feat/ui-measure-demo-layout 전용)는 정식 앱과 작업 표시줄·단일 실행 잠금·저장소를 나눈다
export const APP_USER_MODEL_ID = 'kr.onmaum.demo'

export type RunModeName = 'packaged' | 'dev'

export interface RunMode {
  name: RunModeName
  /** 메인 창이 처음 여는 URL */
  startUrl: string
  /** 두 창이 함께 쓰는 영속 partition */
  partition: string
  /** 기본 userData 대신 쓸 폴더 이름. null이면 기본값. 시연용 빌드는 패키지 실행도 따로 둔다 */
  userDataDirName: string | null
}

/**
 * 패키지 실행은 항상 `app://onmaum/`을 쓴다. 개발 URL은 고정값이라
 * 환경 변수로 바꿀 수 없고, 패키지 실행이 개발 서버에 붙을 길도 없다.
 */
export function resolveRunMode(isPackaged: boolean): RunMode {
  if (isPackaged) {
    return {
      name: 'packaged',
      startUrl: APP_ORIGIN_URL,
      // 시연용 빌드는 정식 앱(기본 userData·persist:onmaum)과 동의·기록·설정을 함께 쓰지 않는다
      partition: 'persist:onmaum-demo',
      userDataDirName: 'onmaum-demo',
    }
  }
  return {
    name: 'dev',
    startUrl: DEV_URL,
    partition: 'persist:onmaum-dev',
    userDataDirName: 'onmaum-dev',
  }
}

/**
 * 메인 창이 처음 여는 화면. 옛 디자인은 폐기하기로 해서(2026-11-04) 새 디자인 메인을 연다.
 * 출처(startUrl)는 그대로 두어 신뢰 판정·권한 규칙은 바뀌지 않는다. 새 화면이 실제 경로로 옮겨지면 이 값만 바꾼다.
 */
export const HOME_PATH = 'demo/hero-stage/'

/** 메인 창이 처음 여는 URL */
export function homeUrl(mode: RunMode): string {
  return new URL(HOME_PATH, mode.startUrl).toString()
}

/** 위젯 창 URL */
export function widgetUrl(mode: RunMode): string {
  return new URL('widget/', mode.startUrl).toString()
}
