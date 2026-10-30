'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getEmotionsByDateRange } from '@/shared/storage/emotionRepository'
import { dailyStressHistory } from '@/features/algorithm/stress/dailyStress'
import { computeBaselineState, BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { useLocalDate } from '@/features/feedback/hooks/useLocalDate'

/** 차트에 보여 주는 날 수. 평소선은 리포트·체크인·넛지와 같은 기간(BASELINE_WINDOW_DAYS)으로 계산한다 */
const DAYS = 7

function formatDateLabel(date: string): string {
  return date.slice(5).replace('-', '/')
}

interface ChartPoint {
  date: string
  label: string
  stress: number
  hasData: boolean
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-ink-900">{p.label}</p>
      {p.hasData ? (
        <p className="mt-1 text-ink-600">스트레스 {Math.round(p.stress)}</p>
      ) : (
        <p className="mt-1 text-ink-400">데이터 없음</p>
      )}
    </div>
  )
}

export default function TrendChart() {
  const today = useLocalDate()
  const records = useLiveQuery(() => {
    const start = new Date()
    start.setDate(start.getDate() - (BASELINE_WINDOW_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return getEmotionsByDateRange(start, end)
  }, [today])

  if (records === undefined) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center text-sm text-ink-500">
        ⏳ 추세 불러오는 중...
      </div>
    )
  }

  const baselineHistory = dailyStressHistory(records, BASELINE_WINDOW_DAYS, new Date())
  const history = baselineHistory.slice(-DAYS)
  const data: ChartPoint[] = history.map((h) => ({
    date: h.date,
    label: formatDateLabel(h.date),
    stress: h.scores ? h.scores.stress : 0,
    hasData: h.scores !== null,
  }))
  const baseline = computeBaselineState(baselineHistory)
  const hasAnyData = data.some((d) => d.hasData)

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-700">최근 7일 스트레스</p>
        {baseline.mode === 'relative' && baseline.baselineN !== null && (
          <p className="text-xs text-ink-500">평소선 {Math.round(baseline.baselineN)}</p>
        )}
      </div>

      {!hasAnyData && <p className="mb-3 text-center text-xs text-ink-400">7일 내 집계 데이터가 없습니다</p>}

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#737373' }} axisLine={{ stroke: '#E5E5E5' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#737373' }} axisLine={{ stroke: '#E5E5E5' }} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#FAFAFA' }} />
            {baseline.mode === 'relative' && baseline.baselineN !== null && (
              <ReferenceLine y={baseline.baselineN} stroke="#A3A3A3" strokeDasharray="4 4" />
            )}
            <Bar dataKey="stress" radius={[4, 4, 0, 0]} fill="#e8806a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
