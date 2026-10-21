import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WeeklyRecords from '@/features/ui/records/WeeklyRecords'
import { db, type EmotionRecord } from '@/shared/storage/db'

function rec(timestamp: string, p: Partial<EmotionRecord> = {}): EmotionRecord {
  return {
    timestamp: new Date(timestamp),
    duration: 10 * 60000,
    detectionRate: 1,
    happy: 0.5,
    calm: 0.3,
    sad: 0.2,
    angry: 0,
    dominantEmotion: 'happy',
    flatAffectScore: 0.5,
    ...p,
  } as EmotionRecord
}

const NOW = new Date('2026-10-21T15:00:00') // 수요일

beforeEach(async () => {
  await db.emotions.clear()
  await db.sessions.clear()
})

describe('WeeklyRecords', () => {
  it('이번 주 7일을 보여 주고 기록한 날의 시간과 지수를 표시한다', async () => {
    await db.emotions.add(rec('2026-10-20T10:00:00'))
    await db.sessions.add({
      id: 's1',
      startedAt: new Date('2026-10-20T09:50:00'),
      endedAt: new Date('2026-10-20T10:00:00'),
      status: 'completed',
      endReason: 'user-stop',
      lastSeenAt: new Date('2026-10-20T10:00:00'),
    })
    render(<WeeklyRecords now={NOW} />)

    await waitFor(() => expect(screen.getByText('이번 주 1일 기록 · 총 10분')).toBeTruthy())
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getAllByText('기록 없음')).toHaveLength(6)
    expect(screen.getByText('긍정 50')).toBeTruthy()
    expect(screen.getByText('스트레스 20')).toBeTruthy()
    expect(screen.getByText('측정 1회')).toBeTruthy()
  })

  it('이전 주로 이동할 수 있고, 이번 주에서는 다음 주로 갈 수 없다', async () => {
    await db.emotions.add(rec('2026-10-14T10:00:00'))
    render(<WeeklyRecords now={NOW} />)
    await waitFor(() => expect(screen.getByText(/이번 주 0일 기록/)).toBeTruthy())
    expect((screen.getByRole('button', { name: '다음 주' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '이전 주' }))
    await waitFor(() => expect(screen.getByText(/이번 주 1일 기록/)).toBeTruthy())
    expect((screen.getByRole('button', { name: '다음 주' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
