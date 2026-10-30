/**
 * 온마음 Electron 메인 프로세스 진입점.
 *
 * - 메인 창: 지금 웹 앱 전체. 측정은 /measure 화면이 소유하고, 최소화해도 계속한다.
 * - 위젯 창: 메인 창이 최소화된 동안 측정 상태를 보여 주는 표시 전용 오브.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  screen,
  session,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron'
import { CHANNELS, type WindowRole } from '../types/bridge'
import { handleAppProtocol, registerAppSchemePrivileges } from './appProtocol'
import { isTrustedSender, parseEnabledFlag, parseSnapshot } from './ipcGuards'
import { APP_USER_MODEL_ID, resolveRunMode, widgetUrl } from './runMode'
import { installGlobalGuards, installPermissionHandlers, restrictNavigation } from './security'
import { DesktopSettingsStore } from './settingsStore'
import {
  initialWidgetState,
  reduceWidgetState,
  resolveWidgetPosition,
  shouldShowWidget,
  type WidgetEvent,
  type WidgetState,
} from './widgetRules'
import { createMainWindow, createWidgetWindow } from './windows'

const mode = resolveRunMode(app.isPackaged)

if (mode.userDataDirName) {
  // 개발 실행의 저장소를 패키지 실행과 분리한다. setPath는 없는 폴더를 받으면 예외를 던지므로 먼저 만든다.
  const devUserData = path.join(app.getPath('appData'), mode.userDataDirName)
  mkdirSync(devUserData, { recursive: true })
  app.setPath('userData', devUserData)
}

registerAppSchemePrivileges()

let mainWindow: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
let settings: DesktopSettingsStore
let widgetState: WidgetState
let lastPushedSeq = -1

function roleOf(contents: WebContents | null): WindowRole {
  if (!contents) return 'unknown'
  if (mainWindow && !mainWindow.isDestroyed() && contents === mainWindow.webContents) return 'main'
  if (widgetWindow && !widgetWindow.isDestroyed() && contents === widgetWindow.webContents) return 'widget'
  return 'unknown'
}

function trusted(event: IpcMainEvent | IpcMainInvokeEvent, channel: string): boolean {
  const frame = event.senderFrame
  return isTrustedSender({
    channel,
    role: roleOf(event.sender),
    isTopFrame: frame !== null && frame === event.sender.mainFrame,
    frameUrl: frame?.url,
    mode: mode.name,
  })
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function widgetPosition() {
  const toRect = (r: Electron.Rectangle) => ({ x: r.x, y: r.y, width: r.width, height: r.height })
  return resolveWidgetPosition(
    settings.get().widget.position,
    screen.getAllDisplays().map((d) => toRect(d.workArea)),
    toRect(screen.getPrimaryDisplay().workArea),
  )
}

function ensureWidgetWindow(ses: Electron.Session): BrowserWindow {
  if (widgetWindow && !widgetWindow.isDestroyed()) return widgetWindow
  const win = createWidgetWindow(ses, widgetPosition())
  restrictNavigation(win.webContents, mode.name, 'widget')
  forwardRendererErrors(win.webContents, '위젯')

  let saveTimer: NodeJS.Timeout | null = null
  win.on('moved', () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      const [x, y] = win.getPosition()
      const current = settings.get()
      try {
        settings.update({ widget: { ...current.widget, position: { x, y } } })
      } catch (err) {
        console.error('[onmaum] 위젯 위치 저장 실패:', err)
      }
    }, 400)
  })
  win.on('closed', () => {
    if (widgetWindow === win) widgetWindow = null
  })
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) win.destroy()
  })
  win.loadURL(widgetUrl(mode)).catch((err: unknown) => {
    console.error('[onmaum] 위젯 로드 실패:', err)
  })
  widgetWindow = win
  lastPushedSeq = -1
  return win
}

function applyWidgetState(ses: Electron.Session): void {
  const show = shouldShowWidget(widgetState)
  if (show) {
    const win = ensureWidgetWindow(ses)
    if (!win.isVisible()) {
      const { x, y } = widgetPosition()
      win.setPosition(x, y)
      win.showInactive()
    }
  } else if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
    widgetWindow.hide()
  }

  if (widgetWindow && !widgetWindow.isDestroyed() && widgetState.view.seq !== lastPushedSeq) {
    widgetWindow.webContents.send(CHANNELS.measurementUpdate, widgetState.view)
    lastPushedSeq = widgetState.view.seq
  }
}

function startDevDiagnostics(): void {
  if (mode.name !== 'dev') return
  setInterval(() => {
    const snap = widgetState.view.snapshot
    const minimized = mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMinimized() : null
    console.log(
      `[측정 진단] ${new Date().toLocaleTimeString('ko-KR')} active=${snap?.active ?? false} ` +
        `videoFps=${snap?.videoFps ?? 'null'} minimized=${minimized} widget=${widgetWindow?.isVisible() ?? false}`,
    )
  }, 10_000)
}

function forwardRendererErrors(contents: WebContents, label: string): void {
  contents.on('console-message', (details) => {
    if (details.level === 'error' || details.level === 'warning') {
      console.log(`[${label} ${details.level}] ${details.message}`)
    }
  })
}

function start(): void {
  if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID)
  if (mode.name === 'packaged') Menu.setApplicationMenu(null)

  installGlobalGuards()
  const ses = session.fromPartition(mode.partition)
  if (mode.name === 'packaged') {
    handleAppProtocol(ses, path.join(app.getAppPath(), 'out'))
  }
  installPermissionHandlers(ses, mode.name, roleOf)

  settings = new DesktopSettingsStore(app.getPath('userData'))
  widgetState = initialWidgetState(settings.get().widget.enabled)

  const dispatch = (event: WidgetEvent) => {
    widgetState = reduceWidgetState(widgetState, event)
    applyWidgetState(ses)
  }

  ipcMain.on(CHANNELS.publishMeasurement, (event, payload: unknown) => {
    if (!trusted(event, CHANNELS.publishMeasurement)) return
    const snapshot = parseSnapshot(payload)
    if (!snapshot) return
    dispatch({ type: 'snapshot', snapshot, now: Date.now() })
  })
  ipcMain.handle(CHANNELS.getMeasurement, (event) => {
    if (!trusted(event, CHANNELS.getMeasurement)) throw new Error('허용되지 않은 호출')
    return widgetState.view
  })
  ipcMain.on(CHANNELS.openMainWindow, (event) => {
    if (!trusted(event, CHANNELS.openMainWindow)) return
    focusMainWindow()
  })
  ipcMain.handle(CHANNELS.getSettings, (event) => {
    if (!trusted(event, CHANNELS.getSettings)) throw new Error('허용되지 않은 호출')
    return settings.get()
  })
  ipcMain.handle(CHANNELS.setWidgetEnabled, (event, value: unknown) => {
    if (!trusted(event, CHANNELS.setWidgetEnabled)) throw new Error('허용되지 않은 호출')
    const enabled = parseEnabledFlag(value)
    if (enabled === null) throw new Error('잘못된 값')
    const current = settings.get()
    const next = settings.update({ widget: { ...current.widget, enabled } })
    dispatch({ type: 'setEnabled', enabled })
    return next
  })

  const win = createMainWindow(ses)
  mainWindow = win
  restrictNavigation(win.webContents, mode.name, 'main')
  forwardRendererErrors(win.webContents, '메인')

  win.on('minimize', () => dispatch({ type: 'minimize' }))
  win.on('restore', () => dispatch({ type: 'restore' }))
  win.webContents.on('did-start-navigation', (details) => {
    // 새로고침·문서 이동이면 측정 화면이 사라진다. 클라이언트 이동은 훅 정리에서 active:false를 보낸다.
    if (details.isMainFrame && !details.isSameDocument) {
      dispatch({ type: 'measurementLost', now: Date.now() })
    }
  })
  win.webContents.on('render-process-gone', () => {
    dispatch({ type: 'measurementLost', now: Date.now() })
  })
  win.on('closed', () => {
    mainWindow = null
    if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.destroy()
    app.quit()
  })

  // 위젯은 미리 만들어 두어 처음 최소화할 때 바로 보이게 한다.
  ensureWidgetWindow(ses)
  startDevDiagnostics()

  // 로드 실패(중간에 다른 이동으로 취소 등)는 앱을 끝낼 이유가 아니므로 기록만 한다.
  win.loadURL(mode.startUrl).catch((err: unknown) => {
    console.error('[onmaum] 메인 화면 로드 실패:', err)
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)
  app.on('window-all-closed', () => app.quit())
  app
    .whenReady()
    .then(start)
    .catch((err: unknown) => {
      console.error('[onmaum] 시작 실패:', err)
      app.exit(1)
    })
}
