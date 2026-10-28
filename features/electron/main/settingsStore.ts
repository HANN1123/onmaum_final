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

  update(next: DesktopSettings): DesktopSettings {
    this.current = { widget: { ...next.widget } }
    const tmp = `${this.filePath}.tmp`
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(tmp, serializeDesktopSettings(this.current), 'utf8')
      fs.renameSync(tmp, this.filePath)
    } catch (err) {
      console.error('[onmaum] 데스크톱 설정 저장 실패:', err)
    }
    return this.get()
  }
}
