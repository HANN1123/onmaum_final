import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { useLocalDate } from '@/features/feedback/hooks/useLocalDate'
import { getEmotionsByDateRange } from '@/shared/storage/emotionRepository'
import { getSessionsByDateRange } from '@/shared/storage/sessionRepository'
import { loadSettings } from '@/shared/storage/settings'
import { buildStoredOverview, type StoredOverview } from './storedOverview'

/**
 * 이 기기에 저장된 최근 14일 기록의 요약. 읽는 중이거나 서버 렌더 중이면 null.
 * 기록이 바뀌면(다른 탭에서 측정·삭제·가져오기) 다시 계산한다. 자정이 지나면 날짜 범위를 옮긴다.
 */
export function useStoredOverview(): StoredOverview | null {
  const today = useLocalDate()
  const data = useLiveQuery(async () => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - (BASELINE_WINDOW_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    const [records, sessions] = await Promise.all([getEmotionsByDateRange(start, end), getSessionsByDateRange(start, end)])
    return { records, sessions, now }
  }, [today])

  // 체크인 보정값. localStorage 는 클라이언트에서만 읽는다(첫 렌더는 0, 기존 /stats 와 같은 방식).
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset(loadSettings().calibrationOffset)
  }, [])

  return useMemo(() => (data ? buildStoredOverview(data.records, data.sessions, data.now, offset) : null), [data, offset])
}
