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
    width: 1100,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    show: false,
    backgroundColor: '#f6f7f6',
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
