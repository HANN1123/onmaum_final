import { describe, it, expect, beforeEach } from 'vitest'
import {
  addEmotionRecord,
  getEmotionsByDate,
  getEmotionsByDateRange,
  deleteAllEmotions,
  type EmotionRecordInput,
} from '@/shared/storage/emotionRepository'
import { db } from '@/shared/storage/db'

function makeInput(overrides: Partial<EmotionRecordInput> = {}): EmotionRecordInput {
  return {
    timestamp: new Date('2026-04-26T12:00:00+09:00'),
    duration: 60000,
    detectionRate: 1,
    happy: 0.5,
    calm: 0.3,
    sad: 0.1,
    angry: 0.1,
    dominantEmotion: 'happy',
    flatAffectScore: 0.8,
    ...overrides,
  }
}

describe('emotionRepository', () => {
  beforeEach(async () => {
    await db.emotions.clear()
  })

  describe('addEmotionRecord', () => {
    it('record 추가 후 auto-increment id 반환', async () => {
      const id = await addEmotionRecord(makeInput())
      expect(typeof id).toBe('number')
      expect(id).toBeGreaterThan(0)
    })

    it('추가한 record를 다시 조회할 수 있다', async () => {
      const id = await addEmotionRecord(makeInput({ happy: 0.77 }))
      const found = await db.emotions.get(id)
      expect(found?.happy).toBeCloseTo(0.77)
    })
  })

  describe('getEmotionsByDateRange', () => {
    it('지정 범위 내 record만 반환', async () => {
      await addEmotionRecord(
        makeInput({ timestamp: new Date('2026-04-26T10:00:00+09:00') }),
      )
      await addEmotionRecord(
        makeInput({ timestamp: new Date('2026-04-26T12:00:00+09:00') }),
      )
      await addEmotionRecord(
        makeInput({ timestamp: new Date('2026-04-26T15:00:00+09:00') }),
      )

      const start = new Date('2026-04-26T11:00:00+09:00')
      const end = new Date('2026-04-26T13:00:00+09:00')
      const results = await getEmotionsByDateRange(start, end)

      expect(results).toHaveLength(1)
      expect(results[0].timestamp.toISOString()).toBe(
        new Date('2026-04-26T12:00:00+09:00').toISOString(),
      )
    })

    it('빈 범위 → 빈 배열', async () => {
      const results = await getEmotionsByDateRange(
        new Date('2030-01-01'),
        new Date('2030-12-31'),
      )
      expect(results).toEqual([])
    })
  })

  describe('getEmotionsByDate', () => {
    it('YYYY-MM-DD 로컬 자정~자정 사이 record 반환', async () => {
      // 사용자 로컬 4/26 자정~자정 사이 3개 추가
      await addEmotionRecord(
        makeInput({ timestamp: new Date('2026-04-26T00:30:00') }),
      )
      await addEmotionRecord(
        makeInput({ timestamp: new Date('2026-04-26T12:00:00') }),
      )
      await addEmotionRecord(
        makeInput({ timestamp: new Date('2026-04-26T23:30:00') }),
      )
      // 다른 날짜 1개
      await addEmotionRecord(
        makeInput({ timestamp: new Date('2026-04-27T00:30:00') }),
      )

      const results = await getEmotionsByDate('2026-04-26')
      expect(results).toHaveLength(3)
    })
  })

  describe('deleteAllEmotions', () => {
    it('모든 record 삭제', async () => {
      await addEmotionRecord(makeInput())
      await addEmotionRecord(makeInput())
      expect(await db.emotions.count()).toBe(2)

      await deleteAllEmotions()
      expect(await db.emotions.count()).toBe(0)
    })
  })
})
