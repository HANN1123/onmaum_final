/**
 * 신뢰 URL·외부 열기 판정. electron을 import하지 않는 순수 모듈.
 *
 * custom scheme의 `URL.origin`은 "null"이므로 origin 문자열로 비교하지 않고
 * protocol·hostname·port·사용자 정보를 각각 검사한다.
 */
import { APP_HOST, APP_SCHEME, DEV_PORT, type RunModeName } from './runMode'

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function isTrustedUrl(url: string, mode: RunModeName): boolean {
  const u = parse(url)
  if (!u) return false
  if (u.username !== '' || u.password !== '') return false

  if (mode === 'packaged') {
    return u.protocol === `${APP_SCHEME}:` && u.hostname === APP_HOST && u.port === ''
  }
  return u.protocol === 'http:' && u.hostname === 'localhost' && u.port === String(DEV_PORT)
}

/** 위젯 창은 `/widget/` 아래만 머문다. */
export function isWidgetUrl(url: string, mode: RunModeName): boolean {
  if (!isTrustedUrl(url, mode)) return false
  const u = new URL(url)
  return u.pathname === '/widget' || u.pathname.startsWith('/widget/')
}

/**
 * 외부 프로그램으로 넘길 수 있는 URL. ContactsFooter·LandingFooter의 상담 전화 링크만 허용한다.
 * 자살예방 상담전화는 1393에서 109로 통합되어 Footer가 바뀌는 중이므로(PR #17) 병합 순서와 관계없이
 * 둘 다 허용한다. Footer의 링크가 모두 이 목록에 있는지는 테스트가 확인한다.
 */
export const EXTERNAL_TEL_ALLOWLIST: readonly string[] = ['tel:1577-0199', 'tel:109', 'tel:1393']

export function isAllowedExternalUrl(url: string): boolean {
  return EXTERNAL_TEL_ALLOWLIST.includes(url)
}
