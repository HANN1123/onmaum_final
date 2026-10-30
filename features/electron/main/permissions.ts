/**
 * 권한 요청·확인 판정. electron을 import하지 않는 순수 모듈.
 *
 * - media: 메인 창의 신뢰 URL에서 video만 허용
 * - notifications: 넛지 알림을 유지하기 위한 명시적 예외. 메인 창의 신뢰 URL에서만 허용
 *   (확인 handler는 WebContents 없이 불리므로 앱 출처로 판정)
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
  /** 확인 요청에 WebContents가 함께 왔는지. 알림 확인은 Electron이 null로 부른다 */
  hasWebContents: boolean
  /** setPermissionCheckHandler의 requestingOrigin */
  requestingOrigin: string
  /** 교차 출처 하위 프레임이 확인할 때만 채워진다 */
  embeddingOrigin?: string
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
  // 알림 권한 확인은 WebContents 없이 오므로 창 역할 대신 요청 출처로 판정한다.
  // 앱 자신의 출처이고 다른 출처에 끼워진 프레임이 아니면 허용한다(확인일 뿐 알림 표시는 요청 handler가 다시 거른다).
  if (input.permission === 'notifications' && !input.hasWebContents) {
    return input.embeddingOrigin === undefined && isTrustedUrl(input.requestingOrigin, input.mode)
  }
  if (!baseAllowed(input)) return false
  if (input.permission === 'notifications') return true
  if (input.permission === 'media') return input.mediaType === 'video'
  return false
}
