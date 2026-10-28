/** `userData/desktop-settings.json` 읽기·쓰기. 쓰기는 임시 파일 후 교체한다. */
import fs from 'node:fs'
import path from 'node:path'
import type { DesktopSettings } from '../types/bridge'
import {
  DESKTOP_SETTINGS_FILE,
  parseDesktopSettings,
  serializeDesktopSettings,
} from './desktopSettings'

export class DesktopSettingsStore {
  private readonly filePath: string
  private current: DesktopSettings

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, DESKTOP_SETTINGS_FILE)
    let raw: string | null = null
    try {
      raw = fs.readFileSync(this.filePath, 'utf8')
    } catch {
      raw = null
    }
    this.current = parseDesktopSettings(raw)
  }

  get(): DesktopSettings {
    return { widget: { ...this.current.widget } }
  }

  /** 파일 교체에 성공한 뒤에만 메모리 값을 바꾼다. 실패하면 예외를 그대로 던져 호출자가 알 수 있게 한다. */
  update(next: DesktopSettings): DesktopSettings {
    const value: DesktopSettings = { widget: { ...next.widget } }
    const tmp = `${this.filePath}.tmp`
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(tmp, serializeDesktopSettings(value), 'utf8')
    fs.renameSync(tmp, this.filePath)
    this.current = value
    return this.get()
  }
}
