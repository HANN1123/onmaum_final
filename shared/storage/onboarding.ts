/** 처음 설문(개인화)을 마쳤는지. 옛 측정 화면(app/measure)과 같은 키를 쓴다. */
export const ONBOARDED_KEY = 'onmaum_onboarded'

/** 설문을 마쳤으면 true. 저장소를 읽을 수 없으면 설문을 다시 묻지 않도록 true 로 본다(옛 측정 화면과 같은 규칙). */
export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true'
  } catch {
    return true
  }
}

/** 설문을 마쳤다고 기록한다. 저장에 실패해도 측정은 막지 않는다. */
export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'true')
  } catch (err) {
    console.error('localStorage 쓰기 실패:', err)
  }
}
