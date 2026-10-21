'use client'

import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEmotionsByDate, getEmotionsByDateRange } from '@/shared/storage/emotionRepository'
import { recentStress, dailyStressHistory } from '@/features/algorithm/stress/dailyStress'
import { computeBaselineState, classifyStress, BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { checkinDue, type CheckinSlot } from '@/features/feedback/lib/checkin'
import { checkinLine } from '@/features/feedback/lib/checkinCopy'
import { applyOffset, nextOffset, type SelfReport } from '@/features/algorithm/baseline/calibration'
import { loadSettings, saveSettings } from '@/shared/storage/settings'
import { loadCheckinDone, saveCheckinEntry, type CheckinContext } from '@/shared/storage/dayState'

interface Args {
  now?: Date
}

interface CheckinView {
  due: boolean
  slot: CheckinSlot | null
  line: string
  submit: (report: SelfReport) => void
}

export function useCheckin({ now = new Date() }: Args = {}): CheckinView {
  const date = now.toLocaleDateString('en-CA')
  const nowMs = now.getTime()

  const todayRecords = useLiveQuery(() => getEmotionsByDate(date), [date])
  const rangeRecords = useLiveQuery(() => {
    const start = new Date(now)
    start.setDate(start.getDate() - (BASELINE_WINDOW_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return getEmotionsByDateRange(start, end)
  }, [date])

  const settings = loadSettings()
  const hasTodayData = (todayRecords?.length ?? 0) > 0

  const { due, slot } = checkinDue({
    now,
    morning: settings.morningWindow,
    afternoon: settings.afternoonWindow,
    doneSlots: loadCheckinDone(date),
    hasTodayData,
  })

  let line = ''
  let context: CheckinContext | undefined
  if (due && todayRecords && rangeRecords) {
    const current = recentStress(todayRecords, now)
    const baseline = computeBaselineState(
      dailyStressHistory(rangeRecords, BASELINE_WINDOW_DAYS, now),
    )
    if (current) {
      const adjusted = applyOffset(current.stress, settings.calibrationOffset)
      const level = classifyStress(adjusted, baseline)
      line = checkinLine(level, baseline.mode)
      context = {
        level,
        recentStress: current.stress,
        adjusted,
        mode: baseline.mode,
        baselineN: baseline.baselineN,
        offsetBefore: settings.calibrationOffset,
      }
    }
  }

  const submit = useCallback(
    (report: SelfReport) => {
      if (!slot) return
      const s = loadSettings()
      saveSettings({ ...s, calibrationOffset: nextOffset(s.calibrationOffset, report) })
      saveCheckinEntry(date, slot, report, nowMs, context)
    },
    [slot, date, nowMs, context],
  )

  return { due, slot, line, submit }
}
