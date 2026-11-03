/**
 * 히어로 이름 칸의 값. 이 기기(localStorage)에만 남는 시안 전용 키이고, 앱 저장 계약(Dexie·프로필)과 무관하다.
 * 이름을 다 지우면 키도 지운다.
 */
const STORAGE_KEY = 'onmaum_demo_name'

export function readDemoName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveDemoName(name: string): void {
  try {
    if (name) localStorage.setItem(STORAGE_KEY, name)
    else localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error('이름 저장 실패:', err)
  }
}
