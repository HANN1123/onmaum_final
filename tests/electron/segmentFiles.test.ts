import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { flattenSegmentFiles } from '../../scripts/electron/segmentFiles.mjs'

const dirs: string[] = []
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'seg-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

function write(root: string, rel: string, body = 'x') {
  const full = path.join(root, ...rel.split('/'))
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, body)
}

describe('flattenSegmentFiles', () => {
  it('폴더로 저장된 세그먼트 파일을 클라이언트가 요청하는 이름으로 옮긴다', () => {
    const out = tmp()
    write(out, 'demo/hero-stage/__next.demo/hero-stage/__PAGE__.txt', 'page')
    write(out, 'stats/__next.stats/__PAGE__.txt', 'stats')
    write(out, 'demo/hero-stage/__next._tree.txt', 'tree')
    write(out, 'demo/hero-stage/index.html', '<html>')

    expect(flattenSegmentFiles(out)).toBe(2)
    expect(fs.readFileSync(path.join(out, 'demo/hero-stage/__next.demo.hero-stage.__PAGE__.txt'), 'utf8')).toBe('page')
    expect(fs.readFileSync(path.join(out, 'stats/__next.stats.__PAGE__.txt'), 'utf8')).toBe('stats')
    expect(fs.existsSync(path.join(out, 'demo/hero-stage/__next.demo'))).toBe(false)
    // 이미 맞는 이름과 다른 파일은 그대로 둔다
    expect(fs.existsSync(path.join(out, 'demo/hero-stage/__next._tree.txt'))).toBe(true)
    expect(fs.existsSync(path.join(out, 'demo/hero-stage/index.html'))).toBe(true)
  })

  it('고칠 것이 없으면 아무것도 옮기지 않는다', () => {
    const out = tmp()
    write(out, 'measure/__next.measure.__PAGE__.txt')
    expect(flattenSegmentFiles(out)).toBe(0)
  })
})
