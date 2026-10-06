import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from '@/lib/storage/settings'

describe('settings', () => {
  beforeEach(() => localStorage.clear())

  it('없으면 기본값', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('저장 후 로드', () => {
    const s = { ...DEFAULT_SETTINGS, calibrationOffset: 6, nudge: { ...DEFAULT_SETTINGS.nudge, enabled: true } }
    saveSettings(s)
    expect(loadSettings()).toEqual(s)
  })

  it('부분 저장된 JSON은 기본값과 병합', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ nudge: { enabled: true } }))
    const loaded = loadSettings()
    expect(loaded.nudge.enabled).toBe(true)
    expect(loaded.nudge.maxPerDay).toBe(DEFAULT_SETTINGS.nudge.maxPerDay)
    expect(loaded.morningWindow).toEqual(DEFAULT_SETTINGS.morningWindow)
    expect(loaded.calibrationOffset).toBe(0)
  })

  it('깨진 JSON → 기본값', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
