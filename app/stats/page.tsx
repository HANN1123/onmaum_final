'use client'

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import CheckInCard from '@/features/feedback/components/CheckInCard'
import DailyReport from '@/features/ui/report/DailyReport'
import NudgeSettings from '@/features/feedback/components/NudgeSettings'
import DesktopWidgetSettings from '@/features/electron/renderer/DesktopWidgetSettings'
import RecentRecords from '@/features/ui/report/RecentRecords'
import TrendChart from '@/features/ui/report/TrendChart'
import { useCheckin } from '@/features/feedback/hooks/useCheckin'
import { getEmotionsByDate, getEmotionsByDateRange } from '@/shared/storage/emotionRepository'
import { loadSettings } from '@/shared/storage/settings'
import { BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { useLocalDate } from '@/features/feedback/hooks/useLocalDate'

export default function StatsPage() {
  const today = useLocalDate()
  // 응답한 체크인(날짜·시간대). 오전에 응답해도 오후 체크인은 따로 뜨도록 시간대별로 기억한다.
  const [answeredCheckin, setAnsweredCheckin] = useState<string | null>(null)

  const todayRecords = useLiveQuery(() => getEmotionsByDate(today), [today])
  const historyRecords = useLiveQuery(() => {
    const start = new Date()
    start.setDate(start.getDate() - (BASELINE_WINDOW_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return getEmotionsByDateRange(start, end)
  }, [today])

  const checkin = useCheckin()
  const checkinKey = checkin.slot ? `${today}:${checkin.slot}` : null
  // localStorage는 클라이언트에서만 — 첫 렌더 0으로 SSR과 일치, mount 후 로드 (hydration mismatch 방지)
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset(loadSettings().calibrationOffset)
  }, [])

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-ink-900">오늘</h1>
          <p className="mt-2 text-sm text-ink-500">마음 한눈에 보기</p>
        </header>

        {checkin.due && checkin.slot && checkinKey !== answeredCheckin && (
          <CheckInCard
            slot={checkin.slot}
            line={checkin.line}
            onReport={(r) => {
              checkin.submit(r)
              setOffset(loadSettings().calibrationOffset)
              setAnsweredCheckin(checkinKey)
            }}
          />
        )}

        <DailyReport
          records={todayRecords ?? []}
          historyRecords={historyRecords ?? []}
          offset={offset}
        />
        <TrendChart />
        <NudgeSettings />
        <DesktopWidgetSettings />
        <RecentRecords />
      </section>
    </main>
  )
}
