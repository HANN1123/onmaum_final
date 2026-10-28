/**
 * 메인 창·위젯 창이 함께 쓰는 preload.
 *
 * 샌드박스 preload는 단일 CommonJS 파일이어야 하므로 로컬 모듈을 런타임 import하지 않는다.
 * 채널 문자열은 types/bridge.ts의 CHANNELS와 같아야 하며 tests/electron/main/ipcGuards.test.ts가 확인한다.
 * 어떤 창이 어떤 채널을 쓸 수 있는지는 메인 프로세스가 보낸 창으로 판정한다.
 */
import { contextBridge, ipcRenderer } from 'electron'
import type {
  DesktopSettings,
  MeasurementSnapshot,
  OnmaumDesktopApi,
  WidgetView,
} from '../types/bridge'

const api: OnmaumDesktopApi = {
  version: process.versions.electron ?? '',
  platform: process.platform,
  capabilities: Object.freeze({ widget: true }),

  publishMeasurement(snapshot: MeasurementSnapshot) {
    ipcRenderer.send('onmaum:measurement:publish', snapshot)
  },

  getMeasurement(): Promise<WidgetView> {
    return ipcRenderer.invoke('onmaum:measurement:get')
  },

  onMeasurement(listener: (view: WidgetView) => void) {
    // IpcRendererEvent는 넘기지 않고 payload만 넘긴다.
    const handler = (_event: unknown, view: WidgetView) => listener(view)
    ipcRenderer.on('onmaum:measurement:update', handler)
    return () => {
      ipcRenderer.removeListener('onmaum:measurement:update', handler)
    }
  },

  openMainWindow() {
    ipcRenderer.send('onmaum:widget:open-main')
  },

  getDesktopSettings(): Promise<DesktopSettings> {
    return ipcRenderer.invoke('onmaum:settings:get')
  },

  setWidgetEnabled(enabled: boolean): Promise<DesktopSettings> {
    return ipcRenderer.invoke('onmaum:settings:set-widget-enabled', enabled)
  },
}

contextBridge.exposeInMainWorld('onmaumDesktop', api)
