/**
 * 권한 handler, 탐색 제한, 외부 열기. 판정은 permissions.ts·trust.ts의 순수 함수가 한다.
 */
import { app, shell, type Session, type WebContents } from 'electron'
import type { WindowRole } from '../types/bridge'
import { decidePermissionCheck, decidePermissionRequest } from './permissions'
import type { RunModeName } from './runMode'
import { isAllowedExternalUrl, isTrustedUrl, isWidgetUrl } from './trust'

export type RoleOf = (contents: WebContents | null) => WindowRole

export function installPermissionHandlers(ses: Session, mode: RunModeName, roleOf: RoleOf): void {
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const d = details as {
      requestingUrl?: string
      isMainFrame?: boolean
      mediaTypes?: string[]
      externalURL?: string
    }
    callback(
      decidePermissionRequest({
        role: roleOf(contents),
        permission,
        requestingUrl: d.requestingUrl,
        isMainFrame: d.isMainFrame === true,
        mode,
        mediaTypes: d.mediaTypes,
        externalUrl: d.externalURL,
      }),
    )
  })

  ses.setPermissionCheckHandler((contents, permission, requestingOrigin, details) =>
    decidePermissionCheck({
      role: roleOf(contents),
      permission,
      requestingUrl: details.requestingUrl,
      isMainFrame: details.isMainFrame,
      mode,
      mediaType: details.mediaType,
      hasWebContents: contents !== null,
      requestingOrigin,
      embeddingOrigin: details.embeddingOrigin,
    }),
  )
}

function openExternalSafely(url: string): void {
  if (!isAllowedExternalUrl(url)) return
  shell.openExternal(url).catch((err: unknown) => {
    console.error('[onmaum] 외부 링크 열기 실패:', url, err)
  })
}

/**
 * 창 하나에 탐색 제한을 건다. 위젯 창은 `/widget/` 밖으로 이동할 수 없다.
 * 허용 목록의 tel: 링크는 앱 안에서 이동하지 않고 외부 프로그램으로 넘긴다.
 */
export function restrictNavigation(contents: WebContents, mode: RunModeName, role: WindowRole): void {
  const allowed = (url: string) =>
    role === 'widget' ? isWidgetUrl(url, mode) : isTrustedUrl(url, mode) && !isWidgetUrl(url, mode)

  const guard = (event: { preventDefault: () => void; url: string }) => {
    if (allowed(event.url)) return
    event.preventDefault()
    if (role === 'main') openExternalSafely(event.url)
  }
  contents.on('will-navigate', guard)
  contents.on('will-redirect', guard)

  contents.setWindowOpenHandler(({ url }) => {
    if (role === 'main') openExternalSafely(url)
    return { action: 'deny' }
  })
}

/** 모든 webContents에 공통으로: webview 부착 금지 */
export function installGlobalGuards(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (e) => e.preventDefault())
  })
}
