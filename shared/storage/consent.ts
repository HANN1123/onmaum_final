export const CONSENT_KEY = 'onmaum_consent'

/**
 * 기록 저장 동의. 처음 설문(또는 측정 화면 안내)에서 한 번 묻고 기억한다.
 * record 가 true 일 때만 측정의 1분 감정 요약을 이 기기(IndexedDB)에 저장한다.
 * 영상·얼굴 이미지·심박 원시값은 동의와 무관하게 저장하지 않는다.
 * 이 기기에서 받은 동의이므로 데이터 가져오기로 옮기지 않는다(personalImport 는 이 키를 무시한다).
 */
export interface StorageConsent {
  version: 1
  record: boolean
  /** 동의·거부를 고른 시각(ISO 문자열) */
  decidedAt: string
}

/** 아직 고르지 않았거나 읽을 수 없으면 null */
export function loadConsent(): StorageConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<StorageConsent>
    if (p.version !== 1 || typeof p.record !== 'boolean' || typeof p.decidedAt !== 'string') return null
    return { version: 1, record: p.record, decidedAt: p.decidedAt }
  } catch {
    return null
  }
}

/** 고른 값을 저장한다. 저장할 수 없는 환경이면 false(이번 화면에서만 따른다) */
export function saveConsent(record: boolean, now: Date = new Date()): boolean {
  if (typeof window === 'undefined') return false
  try {
    const value: StorageConsent = { version: 1, record, decidedAt: now.toISOString() }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
