/**
 * 메인 창 크기 규칙. electron 을 import 하지 않는 순수 모듈.
 *
 * 기본 크기: 측정 화면이 두 열(카메라 | 심박·감정·상태)로 스크롤 없이 보이는 크기다.
 * 2026-11-09 실측(#44 기준, 상태 9행·워치 행, 헤드리스 Chrome·내용 폭 1264): 저장 여부를 고른 뒤 측정 화면은
 * 내용 높이 840 이상, 리포트·기록 화면은 861 이상에서 스크롤이 없었다(그 사이 높이는 재지 않았다).
 * 기존 1280×800(내용 약 761)은 측정·리포트·기록 화면이 넘쳐 스크롤바가 생겼다.
 * 처음 한 번 뜨는 저장 동의 카드까지 담으려면 내용 높이 약 1000이 필요해 기본값에는 넣지 않았다.
 * 같은 날 Windows 패키지 실행에서 바깥 1280×900 창의 내용 영역은 1265×863(DIP)이었다.
 *
 * 최소 크기: 2026-11-04 상태 6행 기준 실측으로 정한 값이다. 행이 늘어난 지금은 이 크기에서 측정 화면이 스크롤될 수 있다.
 * 높이 700 은 1366×768 노트북(작업 표시줄 제외 약 728px)에서도 창이 들어가는 값이다. 배치 규칙은 measureDemo.module.css.
 */

export const MAIN_WINDOW_SIZE = { width: 1280, height: 900 } as const
export const MAIN_WINDOW_MIN_SIZE = { width: 520, height: 700 } as const

export interface MainWindowSize {
  width: number
  height: number
  minWidth: number
  minHeight: number
}

/** 기본·최소 크기를 모니터 작업 영역(DIP) 안으로 줄인다. 작은 노트북에서 창이 화면 밖으로 넘치지 않게 한다. */
export function resolveMainWindowSize(workArea: { width: number; height: number }): MainWindowSize {
  const width = Math.min(MAIN_WINDOW_SIZE.width, workArea.width)
  const height = Math.min(MAIN_WINDOW_SIZE.height, workArea.height)
  return {
    width,
    height,
    minWidth: Math.min(MAIN_WINDOW_MIN_SIZE.width, width),
    minHeight: Math.min(MAIN_WINDOW_MIN_SIZE.height, height),
  }
}
