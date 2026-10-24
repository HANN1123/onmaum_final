import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Emotion } from '../../features/algorithm/emotion/emotionAnalysis'

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
  /** 측정 세션 id. v2 이전 기록과 세션 생성에 실패한 기록에는 없다 */
  sessionId?: string
}

export type SessionStatus = 'active' | 'completed' | 'interrupted'
export type SessionEndReason = 'user-stop' | 'camera-error' | 'recovered'

/** 측정 세션 = "측정 시작"부터 "측정 종료"까지 한 구간 */
export interface MeasurementSession {
  /** 앱에서 만든 UUID. 저장 전에도 감정 기록에 연결할 수 있다 */
  id: string
  startedAt: Date
  /** 정상 종료 또는 복구 시 기록. 진행 중이면 null */
  endedAt: Date | null
  status: SessionStatus
  endReason: SessionEndReason | null
  /** 측정 중 주기적으로 갱신하는 생존 시각. 비정상 종료 판별에 쓴다 */
  lastSeenAt: Date
}

export class OnmaumDB extends Dexie {
  emotions!: EntityTable<EmotionRecord, 'id'>
  /** id는 자동 생성하지 않으므로 저장할 때 반드시 넣는다 (EntityTable은 id를 선택으로 만든다) */
  sessions!: Table<MeasurementSession, string>

  /** name은 테스트에서 DB를 분리할 때만 바꾼다 */
  constructor(name = 'onmaum') {
    super(name)
    this.version(1).stores({
      emotions: '++id, timestamp',
    })
    // v2: 인덱스·테이블 추가만 한다. 기존 기록을 바꾸지 않으므로 upgrade()가 필요 없다.
    // 설계: docs/architecture/SESSION_DATA_DESIGN.md. 설계의 heartRates·sessionSelfReports는
    // rPPG 결과 형식·자기보고 문항 합의 후 다음 버전(v3)에서 추가한다.
    this.version(2).stores({
      emotions: '++id, timestamp, sessionId',
      sessions: 'id, startedAt, status',
    })
  }
}

export const db = new OnmaumDB()
