import type { StorageConsent } from '@/shared/storage/consent'
import type { RecorderStatus } from './measureRecorder'

/**
 * 측정 화면 "기록 저장" 행 문구.
 * 동의 전·거부·측정 전·저장 중(건수)·실패를 구분한다. 저장 실패는 숨기지 않는다.
 */
export function storageRowText(
  consent: StorageConsent | null | undefined,
  active: boolean,
  status: RecorderStatus | null,
): string {
  if (consent === undefined) return '확인 중'
  if (consent === null) return '저장 여부 선택 전 · 저장 안 함'
  if (!consent.record) return '저장 안 함 · 기록 화면에서 바꿀 수 있음'
  if (!active || status === null) return '측정하면 1분마다 저장'
  if (status.failed) return `저장 실패가 있었습니다 · ${status.saved}건 저장`
  return status.saved === 0 ? '저장 중 · 1분마다 기록' : `저장 중 · ${status.saved}건 저장`
}
