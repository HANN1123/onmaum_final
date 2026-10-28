import { EMOTION_ORDER, type Emotion } from '../../features/algorithm/emotion/emotionAnalysis'
import { db, type EmotionRecord, type MeasurementSession, type SessionEndReason, type SessionStatus } from './db'
import { EXPORT_SCHEMA_VERSION, isMeasurementActive, MeasurementActiveError } from './personalData'
import { SETTINGS_KEY } from './settings'
import { PROFILE_KEY } from './profile'

/**
 * 내보낸 기록 파일(JSON)을 이 기기로 가져온다. 웹에서 쓰던 기록을 데스크톱 앱으로 옮길 때 쓴다.
 *
 * - 기존 기록을 지우거나 덮어쓰지 않고 합친다. 같은 기록은 한 번만 들어간다.
 * - 파일은 사용자가 고른 외부 입력이므로 형식·범위를 모두 검사한다. 잘못된 기록은 건너뛰고 개수를 알린다.
 */

/** 받는 파일 크기 상한. 하루 8시간씩 1년 측정해도 수십 MB를 넘지 않는다 */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024
export const MAX_IMPORT_EMOTIONS = 500_000
export const MAX_IMPORT_SESSIONS = 50_000
export const MAX_IMPORT_LOCAL_KEYS = 5_000
/** 감정 기록 하나의 측정 시간 상한. 레코더는 1분마다 저장한다 */
const MAX_RECORD_DURATION_MS = 60 * 60 * 1000
const MAX_ID_LENGTH = 64
const MAX_LOCAL_VALUE_LENGTH = 64 * 1024
/** 이보다 이른 시각의 기록은 잘못된 값으로 본다 */
const EARLIEST_RECORD = Date.UTC(2020, 0, 1)
/** 기기 시계 차이를 감안해 지금보다 하루 뒤까지는 받는다 */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000

/** 가져올 수 있는 localStorage 키. 그 밖의 키는 무시한다 */
const FIXED_LOCAL_KEYS = new Set([SETTINGS_KEY, PROFILE_KEY, 'onmaum_onboarded'])
const DATED_LOCAL_KEY = /^onmaum_(checkin|nudge)_\d{4}-\d{2}-\d{2}$/

const SESSION_STATUSES: readonly SessionStatus[] = ['active', 'completed', 'interrupted']
const END_REASONS: readonly SessionEndReason[] = ['user-stop', 'camera-error', 'recovered']

export type ImportFormatReason = 'tooLarge' | 'notJson' | 'shape' | 'version' | 'tooMany'

/** 파일 자체를 받을 수 없을 때 (기록 일부가 잘못된 경우는 건너뛰고 ImportSummary로 알린다) */
export class ImportFormatError extends Error {
  constructor(readonly reason: ImportFormatReason) {
    super(`가져올 수 없는 파일입니다 (${reason})`)
    this.name = 'ImportFormatError'
  }
}

export interface ParsedImport {
  emotions: Omit<EmotionRecord, 'id'>[]
  sessions: MeasurementSession[]
  localData: [string, string][]
  invalidEmotions: number
  invalidSessions: number
  ignoredLocalKeys: number
}

export interface ImportSummary {
  emotions: { added: number; duplicate: number; invalid: number }
  sessions: { added: number; duplicate: number; invalid: number }
  /** added: 새로 넣음, kept: 이 기기에 이미 있어 그대로 둠, ignored: 가져오지 않는 키·값 */
  localKeys: { added: number; kept: number; ignored: number }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isUnit(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
}

function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_ID_LENGTH
}

function toDate(v: unknown, now: number): Date | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  if (!Number.isFinite(t) || t < EARLIEST_RECORD || t > now + FUTURE_TOLERANCE_MS) return null
  return new Date(t)
}

function parseEmotion(v: unknown, now: number): Omit<EmotionRecord, 'id'> | null {
  if (!isObject(v)) return null
  const timestamp = toDate(v.timestamp, now)
  if (!timestamp) return null
  const { duration, detectionRate, happy, calm, sad, angry, flatAffectScore, dominantEmotion, sessionId } = v
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > MAX_RECORD_DURATION_MS) {
    return null
  }
  if (![detectionRate, happy, calm, sad, angry, flatAffectScore].every(isUnit)) return null
  if (!EMOTION_ORDER.includes(dominantEmotion as Emotion)) return null
  if (sessionId !== undefined && !isId(sessionId)) return null
  return {
    timestamp,
    duration,
    detectionRate: detectionRate as number,
    happy: happy as number,
    calm: calm as number,
    sad: sad as number,
    angry: angry as number,
    dominantEmotion: dominantEmotion as Emotion,
    flatAffectScore: flatAffectScore as number,
    ...(sessionId !== undefined ? { sessionId: sessionId as string } : {}),
  }
}

/** 다른 기기에서 측정 중이던(active) 세션은 이 기기에서 이어질 수 없으므로 복구 종료로 바꾼다 */
function parseSession(v: unknown, now: number): MeasurementSession | null {
  if (!isObject(v) || !isId(v.id)) return null
  const startedAt = toDate(v.startedAt, now)
  const lastSeenAt = toDate(v.lastSeenAt, now)
  if (!startedAt || !lastSeenAt) return null
  if (!SESSION_STATUSES.includes(v.status as SessionStatus)) return null
  const endedAt = v.endedAt === null ? null : toDate(v.endedAt, now)
  if (v.endedAt !== null && !endedAt) return null
  if (v.endReason !== null && !END_REASONS.includes(v.endReason as SessionEndReason)) return null

  if (v.status === 'active') {
    return { id: v.id, startedAt, endedAt: lastSeenAt, status: 'interrupted', endReason: 'recovered', lastSeenAt }
  }
  return {
    id: v.id,
    startedAt,
    endedAt,
    status: v.status as SessionStatus,
    endReason: v.endReason as SessionEndReason | null,
    lastSeenAt,
  }
}

function isImportableKey(key: string): boolean {
  return FIXED_LOCAL_KEYS.has(key) || DATED_LOCAL_KEY.test(key)
}

/** 내보내기는 JSON으로 읽히는 값은 값으로, 아니면 원래 문자열로 담는다. 저장할 문자열로 되돌린다 */
function toStoredString(value: unknown): string | null {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  if (typeof raw !== 'string' || raw.length > MAX_LOCAL_VALUE_LENGTH) return null
  return raw
}

/**
 * 파일 내용을 검사해 가져올 기록으로 바꾼다. 저장소는 건드리지 않는다.
 * 파일 전체를 받을 수 없으면 ImportFormatError를 던진다.
 */
export function parsePersonalDataImport(text: string, now: Date = new Date()): ParsedImport {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportFormatError('tooLarge')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportFormatError('notJson')
  }
  if (!isObject(data)) throw new ImportFormatError('shape')
  if (data.schemaVersion !== EXPORT_SCHEMA_VERSION) throw new ImportFormatError('version')
  const { emotions, sessions, localData } = data
  if (!Array.isArray(emotions) || !Array.isArray(sessions) || !isObject(localData)) {
    throw new ImportFormatError('shape')
  }
  const localEntries = Object.entries(localData)
  if (
    emotions.length > MAX_IMPORT_EMOTIONS ||
    sessions.length > MAX_IMPORT_SESSIONS ||
    localEntries.length > MAX_IMPORT_LOCAL_KEYS
  ) {
    throw new ImportFormatError('tooMany')
  }

  const t = now.getTime()
  const parsedEmotions: Omit<EmotionRecord, 'id'>[] = []
  let invalidEmotions = 0
  for (const e of emotions) {
    const r = parseEmotion(e, t)
    if (r) parsedEmotions.push(r)
    else invalidEmotions += 1
  }
  const parsedSessions: MeasurementSession[] = []
  let invalidSessions = 0
  for (const s of sessions) {
    const r = parseSession(s, t)
    if (r) parsedSessions.push(r)
    else invalidSessions += 1
  }
  const parsedLocal: [string, string][] = []
  let ignoredLocalKeys = 0
  for (const [key, value] of localEntries) {
    const raw = isImportableKey(key) ? toStoredString(value) : null
    if (raw === null) ignoredLocalKeys += 1
    else parsedLocal.push([key, raw])
  }

  return {
    emotions: parsedEmotions,
    sessions: parsedSessions,
    localData: parsedLocal,
    invalidEmotions,
    invalidSessions,
    ignoredLocalKeys,
  }
}

/**
 * 검사를 마친 기록을 이 기기에 합친다.
 * - 감정 기록은 같은 시각(timestamp)의 기록이 이미 있으면 건너뛴다. 파일 안의 중복도 하나만 넣는다.
 * - 세션은 같은 id가 있으면 건너뛴다.
 * - localStorage 값은 이 기기에 없는 키만 넣는다(이 기기의 설정을 덮어쓰지 않는다).
 * 측정 중이면 MeasurementActiveError를 던진다.
 */
export async function importPersonalData(parsed: ParsedImport, now: Date = new Date()): Promise<ImportSummary> {
  if (await isMeasurementActive(now)) throw new MeasurementActiveError()

  const summary: ImportSummary = {
    emotions: { added: 0, duplicate: 0, invalid: parsed.invalidEmotions },
    sessions: { added: 0, duplicate: 0, invalid: parsed.invalidSessions },
    localKeys: { added: 0, kept: 0, ignored: parsed.ignoredLocalKeys },
  }

  await db.transaction('rw', db.emotions, db.sessions, async () => {
    if (parsed.emotions.length > 0) {
      // 기록이 많으면 Math.min(...배열)이 인자 수 한도를 넘으므로 반복문으로 구한다
      let first = Infinity
      let last = -Infinity
      for (const e of parsed.emotions) {
        const t = e.timestamp.getTime()
        if (t < first) first = t
        if (t > last) last = t
      }
      const existing = await db.emotions
        .where('timestamp')
        .between(new Date(first), new Date(last), true, true)
        .toArray()
      const seen = new Set(existing.map((e) => e.timestamp.getTime()))
      const toAdd: Omit<EmotionRecord, 'id'>[] = []
      for (const e of parsed.emotions) {
        const key = e.timestamp.getTime()
        if (seen.has(key)) {
          summary.emotions.duplicate += 1
          continue
        }
        seen.add(key)
        toAdd.push(e)
      }
      // id는 이 기기에서 새로 매긴다
      await db.emotions.bulkAdd(toAdd as EmotionRecord[])
      summary.emotions.added = toAdd.length
    }

    if (parsed.sessions.length > 0) {
      const ids = [...new Set(parsed.sessions.map((s) => s.id))]
      const existing = await db.sessions.bulkGet(ids)
      const seen = new Set(existing.filter((s) => s !== undefined).map((s) => s!.id))
      const toAdd: MeasurementSession[] = []
      for (const s of parsed.sessions) {
        if (seen.has(s.id)) {
          summary.sessions.duplicate += 1
          continue
        }
        seen.add(s.id)
        toAdd.push(s)
      }
      await db.sessions.bulkAdd(toAdd)
      summary.sessions.added = toAdd.length
    }
  })

  if (typeof window !== 'undefined') {
    for (const [key, raw] of parsed.localData) {
      try {
        if (localStorage.getItem(key) !== null) {
          summary.localKeys.kept += 1
          continue
        }
        localStorage.setItem(key, raw)
        summary.localKeys.added += 1
      } catch {
        // 저장소를 쓸 수 없으면 가져오지 못한 키로 센다
        summary.localKeys.ignored += 1
      }
    }
  }

  return summary
}
