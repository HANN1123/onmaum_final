'use client'

import { useState } from 'react'
import type { CheckinSlot } from '@/features/feedback/lib/checkin'
import type { SelfReport } from '@/features/algorithm/baseline/calibration'

interface Props {
  slot: CheckinSlot
  line: string
  onReport: (report: SelfReport) => void
}

const SLOT_LABEL: Record<CheckinSlot, string> = {
  morning: '오전 체크인',
  afternoon: '오후 체크인',
}

export default function CheckInCard({ slot, line, onReport }: Props) {
  const [askDirection, setAskDirection] = useState(false)

  return (
    <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-5">
      <p className="text-xs font-medium text-ink-500">{SLOT_LABEL[slot]}</p>
      <p className="text-base text-ink-900">{line}</p>
      {!askDirection ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReport('agree')}
            className="flex-1 rounded-full bg-risk-good px-4 py-2 text-sm font-medium text-white"
          >
            맞아요
          </button>
          <button
            type="button"
            onClick={() => setAskDirection(true)}
            className="flex-1 rounded-full border border-ink-300 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            지금은 좀 달라요
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReport('worse')}
            className="flex-1 rounded-full border border-ink-300 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            더 힘들었어요
          </button>
          <button
            type="button"
            onClick={() => onReport('better')}
            className="flex-1 rounded-full border border-ink-300 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            사실 괜찮았어요
          </button>
        </div>
      )}
    </div>
  )
}
