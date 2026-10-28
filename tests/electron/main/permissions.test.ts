// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  decidePermissionCheck,
  decidePermissionRequest,
  type PermissionCheckInput,
  type PermissionRequestInput,
} from '@/features/electron/main/permissions'

const req = (o: Partial<PermissionRequestInput>): PermissionRequestInput => ({
  role: 'main',
  permission: 'media',
  requestingUrl: 'app://onmaum/measure/',
  isMainFrame: true,
  mode: 'packaged',
  mediaTypes: ['video'],
  ...o,
})

const chk = (o: Partial<PermissionCheckInput>): PermissionCheckInput => ({
  role: 'main',
  permission: 'media',
  requestingUrl: 'app://onmaum/measure/',
  isMainFrame: true,
  mode: 'packaged',
  mediaType: 'video',
  ...o,
})

describe('decidePermissionRequest (mediaTypes)', () => {
  it('메인 창 신뢰 URL의 video와 notifications를 허용한다', () => {
    expect(decidePermissionRequest(req({}))).toBe(true)
    expect(decidePermissionRequest(req({ permission: 'notifications', mediaTypes: undefined }))).toBe(true)
  })

  it.each<[string, Partial<PermissionRequestInput>]>([
    ['audio', { mediaTypes: ['audio'] }],
    ['video+audio', { mediaTypes: ['video', 'audio'] }],
    ['빈 mediaTypes(unknown)', { mediaTypes: [] }],
    ['mediaTypes 없음', { mediaTypes: undefined }],
    ['화면 공유', { permission: 'display-capture' }],
    ['다른 권한', { permission: 'geolocation' }],
    ['신뢰 URL 밖', { requestingUrl: 'https://example.com/' }],
    ['URL 없음', { requestingUrl: undefined }],
    ['하위 프레임', { isMainFrame: false }],
    ['위젯 창', { role: 'widget' }],
    ['알 수 없는 창', { role: 'unknown' }],
    ['위젯 창 알림', { role: 'widget', permission: 'notifications' }],
  ])('거부: %s', (_, o) => {
    expect(decidePermissionRequest(req(o))).toBe(false)
  })
})

describe('decidePermissionRequest (openExternal)', () => {
  const ext = (externalUrl: string | undefined, o: Partial<PermissionRequestInput> = {}) =>
    decidePermissionRequest(req({ permission: 'openExternal', mediaTypes: undefined, externalUrl, ...o }))

  it('허용 목록의 tel:만 외부로 연다', () => {
    expect(ext('tel:1577-0199')).toBe(true)
    expect(ext('tel:112')).toBe(false)
    expect(ext('mailto:a@b.c')).toBe(false)
    expect(ext(undefined)).toBe(false)
    expect(ext('tel:1577-0199', { role: 'widget' })).toBe(false)
  })
})

describe('decidePermissionCheck (mediaType)', () => {
  it('메인 창 신뢰 URL의 video와 notifications를 허용한다', () => {
    expect(decidePermissionCheck(chk({}))).toBe(true)
    expect(decidePermissionCheck(chk({ permission: 'notifications', mediaType: undefined }))).toBe(true)
  })

  it.each<[string, Partial<PermissionCheckInput>]>([
    ['audio', { mediaType: 'audio' }],
    ['unknown', { mediaType: 'unknown' }],
    ['mediaType 없음', { mediaType: undefined }],
    ['다른 권한', { permission: 'clipboard-read' }],
    ['신뢰 URL 밖', { requestingUrl: 'http://localhost:3003/' }],
    ['하위 프레임', { isMainFrame: false }],
    ['위젯 창', { role: 'widget' }],
  ])('거부: %s', (_, o) => {
    expect(decidePermissionCheck(chk(o))).toBe(false)
  })

  it('개발 모드에서는 localhost:3003만 신뢰한다', () => {
    expect(decidePermissionCheck(chk({ mode: 'dev', requestingUrl: 'http://localhost:3003/measure' }))).toBe(true)
    expect(decidePermissionCheck(chk({ mode: 'dev', requestingUrl: 'app://onmaum/measure/' }))).toBe(false)
  })
})
