/**
 * `app://onmaum/...` 요청을 정적 export 산출물(`out/`) 파일로 해석한다.
 * electron을 import하지 않는 순수 모듈. 파일 시스템 조회는 주입받는다.
 */
import path from 'node:path'

export type EntryKind = 'file' | 'dir' | null

/** 경로가 파일인지 디렉터리인지 없는지 알려 주는 함수 */
export type StatFn = (absolutePath: string) => EntryKind

export type Resolution =
  | { kind: 'file'; filePath: string; mimeType: string; status: 200 }
  /** 없는 문서: 404.html 본문을 404로 준다 */
  | { kind: 'notFoundDocument'; filePath: string | null; mimeType: string; status: 404 }
  /** 없는 자산·payload: 본문 없이 404 */
  | { kind: 'notFound'; status: 404 }
  /** 경로 조작 등 잘못된 요청 */
  | { kind: 'forbidden'; status: 403 }

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
}

export function mimeTypeFor(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

/** 확장자가 없거나 .html이고, 자산 폴더가 아니면 문서 요청으로 본다. */
export function isDocumentPath(pathname: string): boolean {
  if (pathname.startsWith('/_next/') || pathname.startsWith('/models/')) return false
  const ext = path.posix.extname(pathname)
  return ext === '' || ext === '.html'
}

/**
 * URL pathname을 out/ 아래 상대 경로 조각으로 바꾼다. 안전하지 않으면 null.
 * 인코딩된 구분자(%2f, %5c), 역슬래시, NUL, 드라이브 문자, `.`·`..` 조각을 거부한다.
 */
export function toSafeSegments(rawPathname: string): string[] | null {
  if (!rawPathname.startsWith('/')) return null
  if (/%2f|%5c|%00/i.test(rawPathname)) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(rawPathname)
  } catch {
    return null
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return null
  const segments = decoded.split('/').filter((s) => s !== '')
  for (const s of segments) {
    if (s === '.' || s === '..' || s.includes(':')) return null
  }
  return segments
}

function inside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export function resolveAppRequest(outDir: string, rawPathname: string, stat: StatFn): Resolution {
  const root = path.resolve(outDir)
  const segments = toSafeSegments(rawPathname)
  if (!segments) return { kind: 'forbidden', status: 403 }

  const target = path.resolve(root, ...segments)
  if (!inside(root, target)) return { kind: 'forbidden', status: 403 }

  const kind = stat(target)
  if (kind === 'file') {
    return { kind: 'file', filePath: target, mimeType: mimeTypeFor(target), status: 200 }
  }
  if (kind === 'dir') {
    const index = path.join(target, 'index.html')
    if (stat(index) === 'file') {
      return { kind: 'file', filePath: index, mimeType: MIME['.html'], status: 200 }
    }
  }
  // trailingSlash 없이 들어온 문서 요청(`/measure`)은 `/measure.html`도 확인한다.
  if (kind === null && segments.length > 0 && path.extname(target) === '') {
    const html = `${target}.html`
    if (stat(html) === 'file') {
      return { kind: 'file', filePath: html, mimeType: MIME['.html'], status: 200 }
    }
  }

  if (isDocumentPath(rawPathname)) {
    const notFound = path.join(root, '404.html')
    return {
      kind: 'notFoundDocument',
      filePath: stat(notFound) === 'file' ? notFound : null,
      mimeType: MIME['.html'],
      status: 404,
    }
  }
  return { kind: 'notFound', status: 404 }
}
