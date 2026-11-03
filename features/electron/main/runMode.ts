/** 실행 모드별 URL·저장소 분리. electron을 import하지 않는 순수 모듈. */

export const APP_SCHEME = 'app'
export const APP_HOST = 'onmaum'
export const APP_ORIGIN_URL = `${APP_SCHEME}://${APP_HOST}/`
export const DEV_PORT = 3003
export const DEV_URL = `http://localhost:${DEV_PORT}/`
export const APP_USER_MODEL_ID = 'kr.onmaum.app'

export type RunModeName = 'packaged' | 'dev'

export interface RunMode {
  name: RunModeName
  /** 메인 창이 처음 여는 URL */
  startUrl: string
  /** 두 창이 함께 쓰는 영속 partition */
  partition: string
  /** 기본 userData 대신 쓸 폴더 이름. null이면 기본값 */
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
      partition: 'persist:onmaum',
      userDataDirName: null,
    }
  }
  return {
    name: 'dev',
    startUrl: DEV_URL,
    partition: 'persist:onmaum-dev',
    userDataDirName: 'onmaum-dev',
  }
}

/** 위젯 창 URL */
export function widgetUrl(mode: RunMode): string {
  return new URL('widget/', mode.startUrl).toString()
}
