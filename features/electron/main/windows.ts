/** 메인 창과 위젯 창 생성. 두 창은 같은 Session·preload·보안 설정을 쓴다. */
import path from 'node:path'
import { BrowserWindow, type Session } from 'electron'
import { WIDGET_SIZE } from './widgetRules'

export function preloadPath(): string {
  // dist-electron/main/windows.js → dist-electron/preload/index.js
  return path.join(__dirname, '..', 'preload', 'index.js')
}

function secureWebPreferences(ses: Session) {
  return {
    session: ses,
    preload: preloadPath(),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    spellcheck: false,
  }
}

export function createMainWindow(ses: Session): BrowserWindow {
  const win = new BrowserWindow({
    // 기본은 측정 화면이 두 열(카메라 | 심박·감정·상태)로 넉넉히 보이는 크기다.
    width: 1280,
    height: 800,
    // 줄일 수 있는 한도: 이 크기까지 측정 화면의 필요한 정보(카메라·파형·BPM·오브·상태 6행·측정 종료)가 모두 보인다.
    // 2026-11-04 실측: 폭 520 이상·높이 700 이상의 모든 가로·세로 조합에서 스크롤 없이 다 보였다(높이 640~660 세로 창은 마지막 행이 잘림).
    // 높이 700 은 1366×768 노트북(작업 표시줄 제외 약 728px)에서도 창이 들어가는 값이다. 배치 규칙은 measureDemo.module.css.
    minWidth: 520,
    minHeight: 700,
    show: false,
    // 새 디자인 기본 테마(검정)와 같은 색으로 열어 처음 그리기 전 흰 화면이 번쩍이지 않게 한다
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      ...secureWebPreferences(ses),
      // 최소화해도 측정 루프(setTimeout·face-api)가 느려지지 않게 한다.
      // 창 생성 시에만 지정하고 실행 중에 setBackgroundThrottling으로 바꾸지 않는다(Electron #50250).
      backgroundThrottling: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  return win
}

export function createWidgetWindow(ses: Session, position: { x: number; y: number }): BrowserWindow {
  const win = new BrowserWindow({
    ...WIDGET_SIZE,
    ...position,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: '온마음 위젯',
    webPreferences: secureWebPreferences(ses),
  })
  // 문서 제목(온마음)으로 바뀌지 않게 고정해 메인 창과 구분한다.
  win.on('page-title-updated', (event) => event.preventDefault())
  return win
}
