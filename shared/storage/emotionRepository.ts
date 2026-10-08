import { db, type EmotionRecord } from './db'

export type EmotionRecordInput = Omit<EmotionRecord, 'id'>

export async function addEmotionRecord(
  record: EmotionRecordInput,
): Promise<number> {
  return db.emotions.add(record as EmotionRecord)
}

export async function getEmotionsByDateRange(
  start: Date,
  end: Date,
): Promise<EmotionRecord[]> {
  return db.emotions.where('timestamp').between(start, end, true, true).toArray()
}

export async function getEmotionsByDate(date: string): Promise<EmotionRecord[]> {
  // date = "YYYY-MM-DD", 사용자 로컬 자정 기준
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(`${date}T23:59:59.999`)
  return getEmotionsByDateRange(start, end)
}

export async function deleteAllEmotions(): Promise<void> {
  await db.emotions.clear()
}
