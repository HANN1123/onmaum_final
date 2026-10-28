// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isAllowedSender,
  isTrustedSender,
  parseEnabledFlag,
  parseSnapshot,
  type SenderInfo,
} from '@/features/electron/main/ipcGuards'
import { CHANNELS } from '@/features/electron/types/bridge'

const valid = {
  active: true,
  emotions: { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 },
  recordCount: 4,
  videoFps: 30,
  sentAt: 1_700_000_000_000,
}

describe('parseSnapshot', () => {
  it('정상 스냅샷은 새 객체로 돌려준다', () => {
    const r = parseSnapshot(valid)
    expect(r).toEqual(valid)
    expect(r).not.toBe(valid)
  })

  it('emotions·videoFps가 null이어도 받는다', () => {
    expect(parseSnapshot({ ...valid, emotions: null, videoFps: null })).not.toBeNull()
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['배열', []],
    ['문자열', 'x'],
    ['active 누락', { ...valid, active: undefined }],
    ['active 문자열', { ...valid, active: 'true' }],
    ['감정 키 누락', { ...valid, emotions: { happy: 1, calm: 0, sad: 0 } }],
    ['감정 키 추가', { ...valid, emotions: { ...valid.emotions, fear: 0 } }],
    ['감정 범위 밖', { ...valid, emotions: { ...valid.emotions, happy: 2 } }],
    ['감정 NaN', { ...valid, emotions: { ...valid.emotions, sad: Number.NaN } }],
    ['음수 기록 수', { ...valid, recordCount: -1 }],
    ['소수 기록 수', { ...valid, recordCount: 1.5 }],
    ['과도한 기록 수', { ...valid, recordCount: 1e12 }],
    ['음수 fps', { ...valid, videoFps: -1 }],
    ['Infinity fps', { ...valid, videoFps: Number.POSITIVE_INFINITY }],
    ['과도한 fps', { ...valid, videoFps: 10_000 }],
    ['sentAt NaN', { ...valid, sentAt: Number.NaN }],
    ['추가 필드', { ...valid, extra: 'x'.repeat(10) }],
  ])('거부: %s', (_, v) => {
    expect(parseSnapshot(v)).toBeNull()
  })
})

describe('parseEnabledFlag', () => {
  it('boolean만 받는다', () => {
    expect(parseEnabledFlag(true)).toBe(true)
    expect(parseEnabledFlag(false)).toBe(false)
    expect(parseEnabledFlag('true')).toBeNull()
    expect(parseEnabledFlag(1)).toBeNull()
  })
})

describe('isAllowedSender', () => {
  it('채널별 허용 창만 통과한다', () => {
    expect(isAllowedSender(CHANNELS.publishMeasurement, 'main')).toBe(true)
    expect(isAllowedSender(CHANNELS.publishMeasurement, 'widget')).toBe(false)
    expect(isAllowedSender(CHANNELS.getMeasurement, 'widget')).toBe(true)
    expect(isAllowedSender(CHANNELS.getMeasurement, 'main')).toBe(false)
    expect(isAllowedSender(CHANNELS.openMainWindow, 'widget')).toBe(true)
    expect(isAllowedSender(CHANNELS.openMainWindow, 'main')).toBe(false)
    expect(isAllowedSender(CHANNELS.getSettings, 'main')).toBe(true)
    expect(isAllowedSender(CHANNELS.setWidgetEnabled, 'main')).toBe(true)
    expect(isAllowedSender(CHANNELS.setWidgetEnabled, 'widget')).toBe(false)
  })

  it('main → renderer 채널, 알 수 없는 채널, 알 수 없는 창은 거부한다', () => {
    expect(isAllowedSender(CHANNELS.measurementUpdate, 'main')).toBe(false)
    expect(isAllowedSender(CHANNELS.measurementUpdate, 'widget')).toBe(false)
    expect(isAllowedSender('onmaum:unknown', 'main')).toBe(false)
    expect(isAllowedSender('toString', 'main')).toBe(false)
    expect(isAllowedSender(CHANNELS.publishMeasurement, 'unknown')).toBe(false)
  })
})

describe('isTrustedSender', () => {
  const base: SenderInfo = {
    channel: CHANNELS.publishMeasurement,
    role: 'main',
    isTopFrame: true,
    frameUrl: 'app://onmaum/measure/',
    mode: 'packaged',
  }

  it('메인 창 최상위 프레임의 신뢰 URL이면 통과한다', () => {
    expect(isTrustedSender(base)).toBe(true)
  })

  it('하위 프레임, URL 없음, 신뢰 URL 밖은 거부한다', () => {
    expect(isTrustedSender({ ...base, isTopFrame: false })).toBe(false)
    expect(isTrustedSender({ ...base, frameUrl: undefined })).toBe(false)
    expect(isTrustedSender({ ...base, frameUrl: 'https://example.com/' })).toBe(false)
  })

  it('메인 창이 /widget/에 있으면 거부한다', () => {
    expect(isTrustedSender({ ...base, frameUrl: 'app://onmaum/widget/' })).toBe(false)
  })

  it('위젯 창은 /widget/에서만 통과한다', () => {
    const w: SenderInfo = { ...base, channel: CHANNELS.openMainWindow, role: 'widget' }
    expect(isTrustedSender({ ...w, frameUrl: 'app://onmaum/widget/' })).toBe(true)
    expect(isTrustedSender({ ...w, frameUrl: 'app://onmaum/measure/' })).toBe(false)
  })
})

describe('채널 이름', () => {
  it('preload 소스의 채널 문자열이 메인 상수와 같다', () => {
    const src = fs.readFileSync(path.resolve('features/electron/preload/index.ts'), 'utf8')
    const used = new Set([...src.matchAll(/'(onmaum:[a-z:-]+)'/g)].map((m) => m[1]))
    expect([...used].sort()).toEqual(Object.values(CHANNELS).sort())
  })
})
