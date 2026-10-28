/**
 * 권한 요청·확인 판정. electron을 import하지 않는 순수 모듈.
 *
 * - media: 메인 창의 신뢰 URL에서 video만 허용
 * - notifications: 넛지 알림을 유지하기 위한 명시적 예외. 메인 창의 신뢰 URL에서만 허용
 * - openExternal: 허용 목록의 상담 전화(tel:)만 허용
 * - 그 밖의 권한, 위젯 창, 하위 프레임, 신뢰 URL 밖은 모두 거부
 */
import type { WindowRole } from '../types/bridge'
import type { RunModeName } from './runMode'
import { isAllowedExternalUrl, isTrustedUrl } from './trust'

interface BaseInput {
  role: WindowRole
  permission: string
  /** 요청한 문서 URL. 없으면 거부 */
  requestingUrl: string | undefined
  isMainFrame: boolean
  mode: RunModeName
}

export interface PermissionRequestInput extends BaseInput {
  /** setPermissionRequestHandler details.mediaTypes */
  mediaTypes?: readonly string[]
  /** openExternal 요청의 대상 URL (details.externalURL) */
  externalUrl?: string
}

export interface PermissionCheckInput extends BaseInput {
  /** setPermissionCheckHandler details.mediaType */
  mediaType?: string
}

function baseAllowed(input: BaseInput): boolean {
  if (input.role !== 'main') return false
  if (!input.isMainFrame) return false
  if (!input.requestingUrl || !isTrustedUrl(input.requestingUrl, input.mode)) return false
  return true
}

export function decidePermissionRequest(input: PermissionRequestInput): boolean {
  if (!baseAllowed(input)) return false
  if (input.permission === 'notifications') return true
  if (input.permission === 'openExternal') {
    return input.externalUrl !== undefined && isAllowedExternalUrl(input.externalUrl)
  }
  if (input.permission === 'media') {
    const types = input.mediaTypes ?? []
    return types.length > 0 && types.every((t) => t === 'video')
  }
  return false
}

export function decidePermissionCheck(input: PermissionCheckInput): boolean {
  if (!baseAllowed(input)) return false
  if (input.permission === 'notifications') return true
  if (input.permission === 'media') return input.mediaType === 'video'
  return false
}
