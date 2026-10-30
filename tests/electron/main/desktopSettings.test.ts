// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DESKTOP_SETTINGS_FILE,
  parseDesktopSettings,
  serializeDesktopSettings,
} from '@/features/electron/main/desktopSettings'
import { DesktopSettingsStore } from '@/features/electron/main/settingsStore'
import { DEFAULT_DESKTOP_SETTINGS } from '@/features/electron/types/bridge'

describe('parseDesktopSettings', () => {
  it('파일이 없거나 깨졌으면 기본값(위젯 켬)', () => {
    expect(parseDesktopSettings(null)).toEqual(DEFAULT_DESKTOP_SETTINGS)
    expect(parseDesktopSettings('{not json')).toEqual(DEFAULT_DESKTOP_SETTINGS)
    expect(parseDesktopSettings('null')).toEqual(DEFAULT_DESKTOP_SETTINGS)
    expect(parseDesktopSettings('[]')).toEqual(DEFAULT_DESKTOP_SETTINGS)
    expect(DEFAULT_DESKTOP_SETTINGS.widget.enabled).toBe(true)
  })

  it('필드가 빠졌거나 타입이 틀리면 그 필드만 기본값', () => {
    expect(parseDesktopSettings('{"widget":{}}')).toEqual(DEFAULT_DESKTOP_SETTINGS)
    expect(parseDesktopSettings('{"widget":{"enabled":"no","position":{"x":"1","y":2}}}')).toEqual(
      DEFAULT_DESKTOP_SETTINGS,
    )
    expect(parseDesktopSettings('{"widget":{"enabled":false}}').widget).toEqual({
      enabled: false,
      position: null,
    })
  })

  it('저장한 값을 그대로 읽는다', () => {
    const s = { widget: { enabled: false, position: { x: 10, y: -20 } } }
    expect(parseDesktopSettings(serializeDesktopSettings(s))).toEqual(s)
  })

  it('위치는 유한한 숫자만 받고 정수로 맞춘다', () => {
    expect(parseDesktopSettings('{"widget":{"enabled":true,"position":{"x":1.6,"y":2.2}}}').widget.position).toEqual({
      x: 2,
      y: 2,
    })
    expect(parseDesktopSettings('{"widget":{"enabled":true,"position":{"x":1e999,"y":0}}}').widget.position).toBeNull()
  })

  it('기본값 객체를 공유하지 않는다', () => {
    const a = parseDesktopSettings(null)
    a.widget.enabled = false
    expect(DEFAULT_DESKTOP_SETTINGS.widget.enabled).toBe(true)
  })
})

describe('DesktopSettingsStore', () => {
  it('파일 교체에 실패하면 예외를 던지고 이전 값을 유지한다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onmaum-settings-'))
    try {
      const store = new DesktopSettingsStore(dir)
      const next = { widget: { ...DEFAULT_DESKTOP_SETTINGS.widget, enabled: false } }
      // 설정 파일 자리에 폴더를 두어 rename이 실패하게 한다
      fs.mkdirSync(path.join(dir, DESKTOP_SETTINGS_FILE))
      expect(() => store.update(next)).toThrow()
      expect(store.get().widget.enabled).toBe(DEFAULT_DESKTOP_SETTINGS.widget.enabled)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('저장에 성공하면 새 값을 돌려주고 다시 읽어도 같다', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onmaum-settings-'))
    try {
      const next = { widget: { ...DEFAULT_DESKTOP_SETTINGS.widget, enabled: false } }
      expect(new DesktopSettingsStore(dir).update(next).widget.enabled).toBe(false)
      expect(new DesktopSettingsStore(dir).get().widget.enabled).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
