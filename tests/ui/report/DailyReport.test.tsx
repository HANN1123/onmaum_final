import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DailyReport from '@/features/ui/report/DailyReport'
import type { EmotionRecord } from '@/shared/storage/db'

function rec(p: Partial<EmotionRecord> & { timestamp: Date; duration: number }): EmotionRecord {
  return { id: 0, detectionRate: 1, happy: 0, calm: 0, sad: 0, angry: 0, dominantEmotion: 'calm', flatAffectScore: 0, ...p }
}

describe('DailyReport v2', () => {
  beforeEach(() => localStorage.clear())

  it('데이터 없으면 안내', () => {
    render(<DailyReport records={[]} historyRecords={[]} offset={0} now={new Date('2026-06-12T18:00:00')} />)
    expect(screen.getByText(/충분하지 않아요/)).toBeTruthy()
  })

  it('힘들었던 시간대 표시', () => {
    const now = new Date('2026-06-12T18:00:00')
    const records = [rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: 5 * 60000, angry: 0.4 })] // 시간대 표시는 5분 이상 측정 필요
    render(<DailyReport records={records} historyRecords={records} offset={0} now={now} />)
    expect(screen.getByText(/시/)).toBeTruthy() // "14–16시" 형태 시간대 표기
  })

  it('5분 미만으로 측정한 날은 시간대 문구만 숨기고 리포트는 보여 준다', () => {
    const now = new Date('2026-06-12T18:00:00')
    const records = [rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: 60000, angry: 0.4 })]
    render(<DailyReport records={records} historyRecords={records} offset={0} now={now} />)
    expect(screen.queryByText(/힘들었던 시간대/)).toBeNull()
    expect(screen.queryByText(/충분하지 않아요/)).toBeNull()
  })
})
