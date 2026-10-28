/**
 * `app://onmaum/`으로 정적 export 산출물(`out/`)을 제공한다.
 */
import fs from 'node:fs'
import { readFile } from 'node:fs/promises'
import { protocol, type Session } from 'electron'
import { APP_SCHEME } from './runMode'
import { resolveAppRequest, type EntryKind } from './protocolPath'

/**
 * Next inline script(RSC payload 주입)와 face-api(WebGL)가 동작하는 최소 범위.
 * 외부 출처는 허용하지 않는다.
 */
export const APP_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

/** app.ready 전에 한 번만 호출한다. */
export function registerAppSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ])
}

function statSync(absolutePath: string): EntryKind {
  try {
    const s = fs.statSync(absolutePath)
    if (s.isFile()) return 'file'
    if (s.isDirectory()) return 'dir'
    return null
  } catch {
    return null
  }
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': APP_CSP,
  'X-Content-Type-Options': 'nosniff',
}

/** 영속 partition의 Session에 handler를 등록한다. 기본 protocol.handle만으로는 동작하지 않는다. */
export function handleAppProtocol(ses: Session, outDir: string): void {
  ses.protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    const r = resolveAppRequest(outDir, url.pathname, statSync)

    if (r.kind === 'file') {
      const body = await readFile(r.filePath)
      return new Response(new Uint8Array(body), {
        status: 200,
        headers: { 'Content-Type': r.mimeType, ...SECURITY_HEADERS },
      })
    }
    if (r.kind === 'notFoundDocument') {
      const body = r.filePath ? new Uint8Array(await readFile(r.filePath)) : 'Not Found'
      return new Response(body, {
        status: 404,
        headers: { 'Content-Type': r.mimeType, ...SECURITY_HEADERS },
      })
    }
    return new Response(null, { status: r.status, headers: SECURITY_HEADERS })
  })
}
