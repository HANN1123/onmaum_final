// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EXTERNAL_TEL_ALLOWLIST,
  isAllowedExternalUrl,
  isTrustedUrl,
  isWidgetUrl,
} from '@/features/electron/main/trust'
import { resolveRunMode, widgetUrl } from '@/features/electron/main/runMode'

describe('isTrustedUrl (패키지)', () => {
  it.each(['app://onmaum/', 'app://onmaum/measure/', 'app://onmaum/measure/index.txt?_rsc=1'])(
    '허용: %s',
    (url) => expect(isTrustedUrl(url, 'packaged')).toBe(true),
  )

  it.each([
    'app://other/',
    'app://user@onmaum/',
    'app://user:pw@onmaum/',
    'app://onmaum:8080/',
    'file:///C:/Windows/win.ini',
    'javascript:alert(1)',
    'http://localhost:3003/',
    'https://example.com/',
    'not a url',
  ])('거부: %s', (url) => expect(isTrustedUrl(url, 'packaged')).toBe(false))
})

describe('isTrustedUrl (개발)', () => {
  it('localhost:3003만 허용한다', () => {
    expect(isTrustedUrl('http://localhost:3003/measure/', 'dev')).toBe(true)
    expect(isTrustedUrl('http://localhost:3000/', 'dev')).toBe(false)
    expect(isTrustedUrl('http://127.0.0.1:3003/', 'dev')).toBe(false)
    expect(isTrustedUrl('https://localhost:3003/', 'dev')).toBe(false)
    expect(isTrustedUrl('app://onmaum/', 'dev')).toBe(false)
  })
})

describe('isWidgetUrl', () => {
  it('/widget 아래만 위젯 URL이다', () => {
    expect(isWidgetUrl('app://onmaum/widget/', 'packaged')).toBe(true)
    expect(isWidgetUrl('app://onmaum/widget/index.txt', 'packaged')).toBe(true)
    expect(isWidgetUrl('app://onmaum/widgetx/', 'packaged')).toBe(false)
    expect(isWidgetUrl('app://onmaum/measure/', 'packaged')).toBe(false)
    expect(isWidgetUrl('app://other/widget/', 'packaged')).toBe(false)
  })
})

describe('isAllowedExternalUrl', () => {
  it('Footer에 있는 상담 전화만 허용한다', () => {
    for (const url of EXTERNAL_TEL_ALLOWLIST) expect(isAllowedExternalUrl(url)).toBe(true)
    for (const url of ['tel:112', 'tel:1393 ', 'mailto:a@b.c', 'https://example.com', 'http://x']) {
      expect(isAllowedExternalUrl(url)).toBe(false)
    }
  })

  it('허용 목록이 두 Footer의 tel: 링크와 같다', () => {
    const files = ['features/ui/common/ContactsFooter.tsx', 'features/ui/landing/LandingFooter.tsx']
    const found = new Set<string>()
    for (const f of files) {
      const src = fs.readFileSync(path.resolve(f), 'utf8')
      for (const m of src.matchAll(/href="(tel:[^"]+)"/g)) found.add(m[1])
    }
    expect([...found].sort()).toEqual([...EXTERNAL_TEL_ALLOWLIST].sort())
  })
})

describe('resolveRunMode', () => {
  it('패키지 실행은 app://와 영속 partition을 쓴다', () => {
    expect(resolveRunMode(true)).toEqual({
      name: 'packaged',
      startUrl: 'app://onmaum/',
      partition: 'persist:onmaum',
      userDataDirName: null,
    })
  })

  it('패키지 실행은 개발 환경 변수가 있어도 개발 서버에 붙지 않는다', () => {
    const before = process.env.ONMAUM_ELECTRON_DEV_URL
    process.env.ONMAUM_ELECTRON_DEV_URL = 'http://evil.example/'
    try {
      expect(resolveRunMode(true).startUrl).toBe('app://onmaum/')
    } finally {
      if (before === undefined) delete process.env.ONMAUM_ELECTRON_DEV_URL
      else process.env.ONMAUM_ELECTRON_DEV_URL = before
    }
  })

  it('개발 실행은 3003 포트와 별도 partition·userData를 쓴다', () => {
    const dev = resolveRunMode(false)
    expect(dev.startUrl).toBe('http://localhost:3003/')
    expect(dev.partition).toBe('persist:onmaum-dev')
    expect(dev.userDataDirName).toBe('onmaum-dev')
  })

  it('위젯 URL은 /widget/이다', () => {
    expect(widgetUrl(resolveRunMode(true))).toBe('app://onmaum/widget/')
    expect(widgetUrl(resolveRunMode(false))).toBe('http://localhost:3003/widget/')
  })
})
