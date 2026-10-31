import { afterEach, describe, expect, it, vi } from 'vitest'

import { connectHeartRateMonitor, parseHeartRateMeasurement } from '@/features/rppg/lib/heartRateMonitor'

const view = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer)

describe('parseHeartRateMeasurement', () => {
  it('8비트 값을 읽는다', () => {
    expect(parseHeartRateMeasurement(view(0b0000, 72))).toEqual({ bpm: 72, contact: 'unsupported' })
  })

  it('16비트 값은 little-endian으로 읽는다', () => {
    expect(parseHeartRateMeasurement(view(0b0001, 0x48, 0x00))).toEqual({ bpm: 72, contact: 'unsupported' })
  })

  it('접촉 미지원과 접촉 불량을 구분한다', () => {
    expect(parseHeartRateMeasurement(view(0b0100, 72))?.contact).toBe('poor')
    expect(parseHeartRateMeasurement(view(0b0110, 72))?.contact).toBe('good')
    expect(parseHeartRateMeasurement(view(0b0010, 72))?.contact).toBe('unsupported')
  })

  it('에너지·RR 필드가 붙어도 심박을 읽는다', () => {
    expect(parseHeartRateMeasurement(view(0b11000, 72, 0x10, 0x00, 0x20, 0x03))?.bpm).toBe(72)
  })

  it('잘린 패킷과 유효하지 않은 값을 거부한다', () => {
    expect(parseHeartRateMeasurement(view(0b0000))).toBeNull()
    expect(parseHeartRateMeasurement(view(0b0001, 72))).toBeNull()
    expect(parseHeartRateMeasurement(view(0b1000, 72, 0x10))).toBeNull()
    expect(parseHeartRateMeasurement(view(0b0000, 0))).toBeNull()
  })
})

describe('connectHeartRateMonitor', () => {
  function fakeDevice(failNotifications = false) {
    const characteristic = Object.assign(new EventTarget(), {
      value: undefined as DataView | undefined,
      startNotifications: vi.fn(async () => {
        if (failNotifications) throw new Error('알림 실패')
      }),
    })
    const service = { getCharacteristic: vi.fn(async () => characteristic) }
    const server = { getPrimaryService: vi.fn(async () => service) }
    const gatt = { connect: vi.fn(async () => server), disconnect: vi.fn() }
    const device = Object.assign(new EventTarget(), { name: '테스트 기기', gatt })
    vi.stubGlobal('navigator', { bluetooth: { requestDevice: vi.fn(async () => device) } })
    return { characteristic, device, gatt }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('알림을 표본으로 넘기고 연결을 끊으면 더 받지 않는다', async () => {
    const { characteristic, gatt } = fakeDevice()
    const onSample = vi.fn()
    const connection = await connectHeartRateMonitor(onSample, vi.fn())
    expect(connection.name).toBe('테스트 기기')

    characteristic.value = view(0, 70)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
    expect(onSample).toHaveBeenCalledWith(expect.objectContaining({ bpm: 70, contact: 'unsupported' }))

    connection.disconnect()
    expect(gatt.disconnect).toHaveBeenCalled()
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
    expect(onSample).toHaveBeenCalledTimes(1)
  })

  it('기기가 끊기면 알리고 listener를 정리한다', async () => {
    const { characteristic, device } = fakeDevice()
    const onSample = vi.fn()
    const onDisconnect = vi.fn()
    await connectHeartRateMonitor(onSample, onDisconnect)

    device.dispatchEvent(new Event('gattserverdisconnected'))
    expect(onDisconnect).toHaveBeenCalledTimes(1)

    characteristic.value = view(0, 70)
    characteristic.dispatchEvent(new Event('characteristicvaluechanged'))
    expect(onSample).not.toHaveBeenCalled()
  })

  it('구독에 실패하면 연결을 남기지 않는다', async () => {
    const { gatt } = fakeDevice(true)
    await expect(connectHeartRateMonitor(vi.fn(), vi.fn())).rejects.toThrow('알림 실패')
    expect(gatt.disconnect).toHaveBeenCalled()
  })
})
