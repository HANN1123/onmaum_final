// 표준 BLE Heart Rate Service(0x180D)를 Web Bluetooth로 읽는다.
// 규격에 측정 시각이 없으므로 시각은 PC가 받은 시각이다. 워치의 실제 측정 시각과 같다고 보면 안 된다.

import type { ReferenceSample } from '@/features/rppg/lib/rppg'

const MAX_BPM = 250
const DISCONNECTED_DURING_SETUP = '연결 중에 기기가 끊겼어요'

type Contact = ReferenceSample['contact']

/** 0x2A37 값을 읽는다. 잘린 패킷과 유효하지 않은 값은 null */
export function parseHeartRateMeasurement(view: DataView): { bpm: number; contact: Contact } | null {
  if (view.byteLength < 2) return null
  const flags = view.getUint8(0)
  const is16Bit = (flags & 0b0001) !== 0
  const contactSupported = (flags & 0b0100) !== 0
  const contactGood = (flags & 0b0010) !== 0
  const hasEnergy = (flags & 0b1000) !== 0
  const hasRrIntervals = (flags & 0b10000) !== 0

  const valueSize = is16Bit ? 2 : 1
  const fixedSize = 1 + valueSize + (hasEnergy ? 2 : 0)
  if (view.byteLength < fixedSize) return null
  if (hasRrIntervals) {
    const rrBytes = view.byteLength - fixedSize
    if (rrBytes < 2 || rrBytes % 2 !== 0) return null
  }

  const bpm = is16Bit ? view.getUint16(1, true) : view.getUint8(1)
  if (bpm <= 0 || bpm > MAX_BPM) return null

  const contact: Contact = !contactSupported ? 'unsupported' : contactGood ? 'good' : 'poor'
  return { bpm, contact }
}

export interface HeartRateConnection {
  name: string
  disconnect(): void
}

/** 사용자 클릭 안에서 불러야 한다. 기기 선택창이 뜬다 */
export async function connectHeartRateMonitor(
  onSample: (sample: ReferenceSample) => void,
  onDisconnect: () => void,
): Promise<HeartRateConnection> {
  const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })
  if (!device.gatt) throw new Error('이 기기는 GATT 연결을 지원하지 않아요')

  const server = await device.gatt.connect()
  let closed = false
  let characteristic: BluetoothRemoteGATTCharacteristic | null = null

  const handleValue = () => {
    const value = characteristic?.value
    if (!value) return
    const parsed = parseHeartRateMeasurement(value)
    if (parsed) onSample({ t: performance.now(), ...parsed })
  }

  const cleanup = () => {
    if (closed) return
    closed = true
    characteristic?.removeEventListener('characteristicvaluechanged', handleValue)
    device.removeEventListener('gattserverdisconnected', handleDisconnected)
  }

  function handleDisconnected() {
    cleanup()
    onDisconnect()
  }

  device.addEventListener('gattserverdisconnected', handleDisconnected)

  try {
    const service = await server.getPrimaryService('heart_rate')
    characteristic = await service.getCharacteristic('heart_rate_measurement')
    if (closed) throw new Error(DISCONNECTED_DURING_SETUP)
    characteristic.addEventListener('characteristicvaluechanged', handleValue)
    await characteristic.startNotifications()
    if (closed) throw new Error(DISCONNECTED_DURING_SETUP)
  } catch (err) {
    cleanup()
    device.gatt.disconnect()
    throw err
  }

  return {
    name: device.name ?? '이름 없는 기기',
    disconnect() {
      cleanup()
      device.gatt?.disconnect()
    },
  }
}
