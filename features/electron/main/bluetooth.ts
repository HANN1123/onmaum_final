import type { BrowserWindow, Session } from 'electron'
import type { RunModeName } from './runMode'
import { decideBluetoothDevice } from './bluetoothChooser'
import { isTrustedUrl } from './trust'

/** 결정을 다시 볼 주기. 이벤트가 오지 않아도 대기 시간이 지나면 끝내야 한다 */
const TICK_MS = 500

/**
 * 메인 창의 Web Bluetooth 장치 선택(워치 연동)을 처리한다. 선택 규칙은 bluetoothChooser.ts.
 * - 이벤트마다 preventDefault() 를 부른다. 부르지 않으면 Electron 이 첫 장치를 자동으로 고를 수 있다.
 * - 한 요청은 한 번만 끝내고(선택 또는 취소), 타이머는 요청 시작 때 한 번만 건다.
 * - 장치 이름·ID 는 로그에 남기지 않는다.
 */
export function installBluetoothChooser(win: BrowserWindow, mode: RunModeName): void {
  let pending: {
    callback: (deviceId: string) => void
    deviceIds: string[]
    startedAt: number
    timer: ReturnType<typeof setInterval>
  } | null = null

  const finish = (deviceId: string) => {
    if (!pending) return
    const { callback, timer } = pending
    pending = null
    clearInterval(timer)
    callback(deviceId)
  }

  const evaluate = () => {
    if (!pending) return
    const decision = decideBluetoothDevice({
      trusted: !win.isDestroyed() && isTrustedUrl(win.webContents.getURL(), mode),
      deviceIds: pending.deviceIds,
      elapsedMs: Date.now() - pending.startedAt,
    })
    if (decision.type === 'select') finish(decision.deviceId)
    else if (decision.type === 'cancel') {
      console.log(`[onmaum] 워치 장치 선택 취소: ${decision.reason}`)
      finish('')
    }
  }

  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault()
    if (!pending) {
      pending = { callback, deviceIds: [], startedAt: Date.now(), timer: setInterval(evaluate, TICK_MS) }
    } else {
      // 같은 요청의 반복 이벤트: 가장 최근 callback 으로 끝낸다(목록만 갱신, 시간은 늘리지 않는다)
      pending.callback = callback
    }
    pending.deviceIds = devices.map((d) => d.deviceId)
    evaluate()
  })

  // 창이 닫히거나 다른 문서로 이동하면 진행 중인 요청을 취소한다
  win.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) finish('')
  })
  win.on('closed', () => finish(''))
}

/**
 * Windows·Linux 의 추가 페어링 요청(확인·PIN)은 1차 구현에서 지원하지 않으므로 거부한다.
 * 심박 방송(Heart Rate 서비스)은 보통 페어링 없이 연결된다. 거부하면 웹 쪽 연결이 실패로 끝나고 화면이 안내한다.
 */
export function installBluetoothPairingDenial(ses: Session): void {
  if (process.platform !== 'win32' && process.platform !== 'linux') return
  ses.setBluetoothPairingHandler((_details, callback) => {
    console.log('[onmaum] 워치 추가 페어링 요청을 거부했습니다(지원 안 함)')
    callback({ confirmed: false })
  })
}
