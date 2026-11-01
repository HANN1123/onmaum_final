import { useCallback, useEffect, useState } from 'react'

export type DemoTheme = 'dark' | 'light'

/** 시안 전용 저장 키. 앱 저장 계약(Dexie)과 무관하다. */
const STORAGE_KEY = 'onmaum_demo_theme'

function readTheme(): DemoTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** 검정/흰색 시안 테마. 기기에 남아 화면을 오가도 유지된다. */
export function useDemoTheme(): [DemoTheme, () => void] {
  const [theme, setTheme] = useState<DemoTheme>('dark')

  useEffect(() => {
    // localStorage 는 클라이언트에서만 — mount 후 읽어 첫 렌더를 서버와 맞춘다 (hydration mismatch 방지)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readTheme())
  }, [])

  const toggle = useCallback(() => {
    const next: DemoTheme = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch (err) {
      console.error('테마 저장 실패:', err)
    }
    setTheme(next)
  }, [theme])

  return [theme, toggle]
}
