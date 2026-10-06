import Dexie, { type EntityTable } from 'dexie'
import type { Emotion } from '../emotion/emotionAnalysis'

export interface EmotionRecord {
  id: number
  timestamp: Date
  duration: number
  detectionRate: number
  happy: number
  calm: number
  sad: number
  angry: number
  dominantEmotion: Emotion
  flatAffectScore: number
}

export class OnmaumDB extends Dexie {
  emotions!: EntityTable<EmotionRecord, 'id'>

  constructor() {
    super('onmaum')
    this.version(1).stores({
      emotions: '++id, timestamp',
    })
  }
}

export const db = new OnmaumDB()
