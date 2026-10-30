'use client'

import { useEffect, useState } from 'react'

function localDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD (로컬)
}

/** 다음 로컬 자정까지 남은 시간(ms). 자정 직후에 깨도록 1초 여유를 둔다 */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now)
  next.setHours(24, 0, 1, 0)
  return next.getTime() - now.getTime()
}

/**
 * 오늘 날짜(YYYY-MM-DD, 로컬). 자정이 지나거나 창이 다시 보이면 갱신해 다시 그린다.
 * 화면을 켜 둔 채(또는 Electron에서 최소화한 채) 밤을 넘겨도 "오늘" 조회가 이전 날짜에 머물지 않게 한다.
 */
export function useLocalDate(): string {
  const [today, setToday] = useState(() => localDateKey(new Date()))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      setToday(localDateKey(new Date()))
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(refresh, msUntilNextLocalMidnight(new Date()))
    }
    // 절전 복귀 등으로 타이머가 늦게 깨는 경우를 위해 창이 다시 보일 때도 확인한다
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    timer = setTimeout(refresh, msUntilNextLocalMidnight(new Date()))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}
