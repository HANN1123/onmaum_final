import { describe, expect, it } from 'vitest'
import { decideBluetoothDevice, SETTLE_MS, TIMEOUT_MS } from '@/features/electron/main/bluetoothChooser'

describe('decideBluetoothDevice (워치 장치 선택)', () => {
  it('신뢰하지 않는 창의 요청은 바로 취소한다', () => {
    expect(decideBluetoothDevice({ trusted: false, deviceIds: ['a'], elapsedMs: SETTLE_MS })).toEqual({ type: 'cancel', reason: 'untrusted' })
  })

  it('후보를 모으는 동안은 기다린다', () => {
    expect(decideBluetoothDevice({ trusted: true, deviceIds: ['a'], elapsedMs: SETTLE_MS - 1 })).toEqual({ type: 'wait' })
  })

  it('모은 뒤 후보가 하나면 그 장치를 고른다(중복 ID는 하나로 센다)', () => {
    expect(decideBluetoothDevice({ trusted: true, deviceIds: ['a', 'a'], elapsedMs: SETTLE_MS })).toEqual({ type: 'select', deviceId: 'a' })
  })

  it('후보가 여러 개면 아무거나 고르지 않고 취소한다', () => {
    expect(decideBluetoothDevice({ trusted: true, deviceIds: ['a', 'b'], elapsedMs: SETTLE_MS })).toEqual({ type: 'cancel', reason: 'multiple' })
  })

  it('끝까지 후보가 없으면 시간 초과로 취소한다', () => {
    expect(decideBluetoothDevice({ trusted: true, deviceIds: [], elapsedMs: TIMEOUT_MS - 1 })).toEqual({ type: 'wait' })
    expect(decideBluetoothDevice({ trusted: true, deviceIds: [], elapsedMs: TIMEOUT_MS })).toEqual({ type: 'cancel', reason: 'timeout' })
  })
})
