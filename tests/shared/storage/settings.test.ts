import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from '@/shared/storage/settings'

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

describe('settings: 체크인 시간대·OS 알림', () => {
  beforeEach(() => localStorage.clear())
  it('이전 설정에는 없던 값은 이전 동작과 같은 기본값으로 읽는다', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ nudge: { enabled: true } }))
    const s = loadSettings()
    expect(s.checkinSlots).toEqual({ morning: true, afternoon: true })
    expect(s.nudge.osNotify).toBe(true)
  })
  it('저장하면 같은 탭에 바뀜을 알린다', () => {
    let fired = 0
    const on = () => { fired += 1 }
    window.addEventListener('onmaum:settings-changed', on)
    saveSettings({ ...DEFAULT_SETTINGS, checkinSlots: { morning: false, afternoon: true } })
    window.removeEventListener('onmaum:settings-changed', on)
    expect(fired).toBe(1)
    expect(loadSettings().checkinSlots.morning).toBe(false)
  })
})
