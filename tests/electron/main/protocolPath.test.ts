// @vitest-environment node
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveAppRequest,
  toSafeSegments,
  type EntryKind,
} from '@/features/electron/main/protocolPath'

const OUT = path.resolve('/srv/onmaum/out')

/** out/ 아래 가짜 파일 트리 */
function fakeStat(files: string[], dirs: string[]) {
  const f = new Set(files.map((p) => path.join(OUT, p)))
  const d = new Set([OUT, ...dirs.map((p) => path.join(OUT, p))])
  return (abs: string): EntryKind => (f.has(abs) ? 'file' : d.has(abs) ? 'dir' : null)
}

const stat = fakeStat(
  [
    'index.html',
    '404.html',
    'index.txt',
    'measure/index.html',
    'measure/index.txt',
    '_next/static/chunks/app.js',
    '_next/static/css/app.css',
    'models/tiny_face_detector_model-shard1',
    'models/tiny_face_detector_model-weights_manifest.json',
  ],
  ['measure', '_next', '_next/static', 'models'],
)

describe('resolveAppRequest', () => {
  it('정상 파일을 MIME과 함께 준다', () => {
    const r = resolveAppRequest(OUT, '/_next/static/chunks/app.js', stat)
    expect(r).toMatchObject({ kind: 'file', status: 200, mimeType: 'text/javascript; charset=utf-8' })
  })

  it('디렉터리 요청에는 index.html을 준다', () => {
    expect(resolveAppRequest(OUT, '/', stat)).toMatchObject({
      kind: 'file',
      filePath: path.join(OUT, 'index.html'),
      mimeType: 'text/html; charset=utf-8',
    })
    expect(resolveAppRequest(OUT, '/measure/', stat)).toMatchObject({
      kind: 'file',
      filePath: path.join(OUT, 'measure', 'index.html'),
    })
  })

  it('RSC payload(.txt)는 text/plain으로 준다', () => {
    expect(resolveAppRequest(OUT, '/measure/index.txt', stat)).toMatchObject({
      kind: 'file',
      mimeType: 'text/plain; charset=utf-8',
    })
  })

  it('확장자 없는 모델 shard는 바이너리로 준다', () => {
    expect(resolveAppRequest(OUT, '/models/tiny_face_detector_model-shard1', stat)).toMatchObject({
      kind: 'file',
      mimeType: 'application/octet-stream',
    })
  })

  it('없는 문서에는 404와 404.html을 준다', () => {
    expect(resolveAppRequest(OUT, '/nope/', stat)).toEqual({
      kind: 'notFoundDocument',
      filePath: path.join(OUT, '404.html'),
      mimeType: 'text/html; charset=utf-8',
      status: 404,
    })
  })

  it('없는 JS·모델·payload에는 HTML 없이 404만 준다', () => {
    for (const p of ['/_next/static/chunks/missing.js', '/models/missing-shard9', '/stats/index.txt']) {
      expect(resolveAppRequest(OUT, p, stat)).toEqual({ kind: 'notFound', status: 404 })
    }
  })

  it.each([
    '/../secret.txt',
    '/measure/../../secret.txt',
    '/%2e%2e/secret.txt',
    '/%2E%2E/%2E%2E/secret.txt',
    '/measure%2f..%2f..%2fsecret.txt',
    '/measure%5c..%5csecret.txt',
    '/..\\secret.txt',
    '/C:/Windows/win.ini',
    '/%00',
    '/%E0%A4%A',
  ])('out/ 밖이나 잘못된 경로는 거부한다: %s', (p) => {
    expect(resolveAppRequest(OUT, p, stat)).toEqual({ kind: 'forbidden', status: 403 })
  })
})

describe('toSafeSegments', () => {
  it('정상 경로를 조각으로 나눈다', () => {
    expect(toSafeSegments('/a/b%20c/')).toEqual(['a', 'b c'])
  })
  it('슬래시로 시작하지 않으면 거부한다', () => {
    expect(toSafeSegments('a/b')).toBeNull()
  })
})
