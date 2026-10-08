export const PROFILE_KEY = 'onmaum_profile'

/** 로컬 프로필 — "나만의 스트레스 해소법" 설문 결과. 데이터는 기기에만(서버 없음). */
export interface Profile {
  reliefs: string[]
}

export function loadProfile(): Profile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as { reliefs?: unknown }).reliefs)
    ) {
      return null
    }
    return { reliefs: (parsed as { reliefs: string[] }).reliefs }
  } catch {
    return null
  }
}

export function saveProfile(profile: Profile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // 저장 불가 환경은 조용히 무시 (프라이버시: 서버 폴백 없음)
  }
}
