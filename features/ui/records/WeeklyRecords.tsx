'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { dailyStressHistory } from '@/features/algorithm/stress/dailyStress'
import { getPersonalRecordsByRange, weekRange } from '@/shared/storage/personalData'

function localDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function formatDay(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatMinutes(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}분`
  return `${Math.floor(min / 60)}시간 ${min % 60}분`
}

interface Props {
  /** 테스트·미리보기용. 기본은 현재 시각 */
  now?: Date
}

export default function WeeklyRecords({ now }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const anchor = new Date(now ?? new Date())
  anchor.setDate(anchor.getDate() + weekOffset * 7)
  const { start, end } = weekRange(anchor)
  const startKey = localDateKey(start)

  const records = useLiveQuery(() => getPersonalRecordsByRange(start, end), [startKey])

  const days = records ? dailyStressHistory(records.emotions, 7, end) : []
  const sessionsPerDay = new Map<string, number>()
  for (const s of records?.sessions ?? []) {
    const k = localDateKey(s.startedAt)
    sessionsPerDay.set(k, (sessionsPerDay.get(k) ?? 0) + 1)
  }
  const weekTotal = days.reduce((sum, d) => sum + d.totalDuration, 0)
  const recordedDays = days.filter((d) => d.totalDuration > 0).length

  return (
    <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w - 1)}
          className="rounded-lg px-2 py-1 text-sm text-ink-500 hover:text-ink-800"
          aria-label="이전 주"
        >
          ‹ 이전 주
        </button>
        <p className="text-sm font-medium text-ink-900">
          {formatDay(startKey)} – {formatDay(localDateKey(end))}
        </p>
        <button
          type="button"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={weekOffset >= 0}
          className="rounded-lg px-2 py-1 text-sm text-ink-500 hover:text-ink-800 disabled:invisible"
          aria-label="다음 주"
        >
          다음 주 ›
        </button>
      </div>

      {records === undefined ? (
        <p className="py-6 text-center text-sm text-ink-400">불러오는 중…</p>
      ) : (
        <>
          <p className="text-xs text-ink-500">
            이번 주 {recordedDays}일 기록 · 총 {formatMinutes(weekTotal)}
          </p>
          <ul className="divide-y divide-ink-100">
            {days.map((d) => {
              const sessions = sessionsPerDay.get(d.date) ?? 0
              return (
                <li key={d.date} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="w-20 shrink-0 text-ink-700">{formatDay(d.date)}</span>
                  {d.scores ? (
                    <span className="flex flex-1 flex-wrap justify-end gap-x-3 gap-y-0.5 text-xs tabular-nums text-ink-600">
                      <span>{formatMinutes(d.totalDuration)}</span>
                      <span className="text-risk-good">긍정 {Math.round(d.scores.positive)}</span>
                      <span className="text-risk-warning">스트레스 {Math.round(d.scores.stress)}</span>
                      {sessions > 0 && <span>측정 {sessions}회</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-400">기록 없음</span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
