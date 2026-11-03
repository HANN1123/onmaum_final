/**
 * Electron 의 Web Bluetooth 장치 선택 규칙. electron 을 import 하지 않는 순수 모듈.
 *
 * Electron 에는 브라우저 같은 장치 선택 창이 없어서, `navigator.bluetooth.requestDevice` 를 부르면
 * 메인 프로세스의 `select-bluetooth-device` 이벤트가 검색된 목록과 함께 여러 번 온다. 여기서 장치를 고르거나 취소한다.
 * (Electron 45 에는 Bluetooth 용 setDevicePermissionHandler·'bluetooth' 권한 항목이 없다. 이 이벤트에서 직접 검사한다.)
 *
 * 규칙(전시용 워치 연동, 2026-11-04):
 * - 요청한 창이 신뢰 URL 의 메인 창이 아니면 즉시 취소한다.
 * - 목록은 웹 쪽 필터(Heart Rate 서비스)로 이미 걸러져 온다. 이름으로 장치를 가리지 않는다(이름은 본인 기기를 증명하지 못한다).
 * - 검색 시작 뒤 SETTLE_MS 동안 기다려 후보를 모은다. 그때 후보가 **하나**면 그 장치를 고른다.
 * - 후보가 **여러 개**면 아무거나 고르지 않고 취소한다(화면이 "하나만 켜고 다시"를 안내).
 * - TIMEOUT_MS 까지 후보가 없으면 취소한다.
 * - 한 요청은 한 번만 끝낸다. 반복 이벤트로 시간을 늘리지 않는다.
 */

export const SETTLE_MS = 3_000
export const TIMEOUT_MS = 12_000

export interface ChooserInput {
  /** 요청한 창이 신뢰 URL 의 메인 창인지 */
  trusted: boolean
  /** 지금까지 검색된 장치 ID 목록(중복 없음) */
  deviceIds: readonly string[]
  /** 이 요청의 첫 이벤트 뒤 지난 시간(ms) */
  elapsedMs: number
}

export type ChooserDecision =
  | { type: 'wait' }
  | { type: 'select'; deviceId: string }
  | { type: 'cancel'; reason: 'untrusted' | 'multiple' | 'timeout' }

export function decideBluetoothDevice({ trusted, deviceIds, elapsedMs }: ChooserInput): ChooserDecision {
  if (!trusted) return { type: 'cancel', reason: 'untrusted' }
  const unique = [...new Set(deviceIds)]
  if (elapsedMs >= SETTLE_MS && unique.length > 1) return { type: 'cancel', reason: 'multiple' }
  if (elapsedMs >= SETTLE_MS && unique.length === 1) return { type: 'select', deviceId: unique[0] }
  if (elapsedMs >= TIMEOUT_MS) return { type: 'cancel', reason: 'timeout' }
  return { type: 'wait' }
}
