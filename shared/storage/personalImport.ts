import { EMOTION_ORDER, type Emotion } from '../../features/algorithm/emotion/emotionAnalysis'
import { OFFSET_MAX } from '../../features/algorithm/baseline/calibration'
import { db, type EmotionRecord, type MeasurementSession, type SessionEndReason, type SessionStatus } from './db'
import { EXPORT_SCHEMA_VERSION, isMeasurementActive, MeasurementActiveError } from './personalData'
import { SETTINGS_KEY } from './settings'
import { PROFILE_KEY } from './profile'

/**
 * 내보낸 기록 파일(JSON)을 이 기기로 가져온다. 웹에서 쓰던 기록을 데스크톱 앱으로 옮길 때 쓴다.
 *
 * - 기존 기록을 지우거나 덮어쓰지 않고 합친다. 같은 기록은 한 번만 들어간다.
 * - 파일은 사용자가 고른 외부 입력이므로 형식·범위·관계를 모두 검사한다. 잘못된 기록은 건너뛰고 개수를 알린다.
 */

/** 받는 파일 크기 상한. 하루 8시간씩 1년 측정해도 수십 MB를 넘지 않는다 */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024
export const MAX_IMPORT_EMOTIONS = 500_000
export const MAX_IMPORT_SESSIONS = 50_000
export const MAX_IMPORT_LOCAL_KEYS = 5_000
/** 감정 기록 하나의 측정 시간 상한. 레코더는 1분마다 저장한다 */
const MAX_RECORD_DURATION_MS = 60 * 60 * 1000
/** 네 감정 비율의 합은 1이다(normalizeExpressions). 부동소수 오차만 허용한다 */
const EMOTION_SUM_TOLERANCE = 0.01
const MAX_ID_LENGTH = 64
const MAX_LOCAL_VALUE_LENGTH = 64 * 1024
/** 이보다 이른 시각의 기록은 잘못된 값으로 본다 */
const EARLIEST_RECORD = Date.UTC(2020, 0, 1)
/**
 * 기기 시계 차이로 받는 미래 시각의 여유. 길게 두면 미래 기록 하나가
 * isMeasurementActive를 그 시각까지 "측정 중"으로 만들어 삭제·가져오기를 막는다.
 */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

const DATED_LOCAL_KEY = /^onmaum_(checkin|nudge)_\d{4}-\d{2}-\d{2}$/
const ONBOARDED_KEY = 'onmaum_onboarded'

const SESSION_STATUSES: readonly SessionStatus[] = ['active', 'completed', 'interrupted']
const END_REASONS: readonly SessionEndReason[] = ['user-stop', 'camera-error', 'recovered']
const CHECKIN_SLOTS: readonly string[] = ['morning', 'afternoon']
const SELF_REPORTS: readonly string[] = ['agree', 'worse', 'better']
const DAY_MS = 24 * 60 * 60 * 1000

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
  /** 저장할 문자열로 정리한 localStorage 값 */
  localData: [string, string][]
  invalidEmotions: number
  invalidSessions: number
  ignoredLocalKeys: number
}

export interface ImportSummary {
  emotions: { added: number; duplicate: number; invalid: number }
  /** updated: 자동 복구로 끝난 기존 세션을 파일의 더 나중 상태로 바꿈 */
  sessions: { added: number; updated: number; duplicate: number; invalid: number }
  /**
   * added: 새로 넣음, kept: 이 기기에 이미 있어 그대로 둠,
   * ignored: 가져오지 않는 키이거나 값이 잘못됨, failed: 저장소 오류로 쓰지 못함
   */
  localKeys: { added: number; kept: number; ignored: number; failed: number }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isUnit(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
}

function isIntIn(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
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
  const sum = (happy as number) + (calm as number) + (sad as number) + (angry as number)
  if (Math.abs(sum - 1) > EMOTION_SUM_TOLERANCE) return null
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

/**
 * 세션 하나를 검사한다. 시작보다 이른 종료·생존 시각, 끝난 세션의 빈 종료 정보처럼 앞뒤가 맞지 않으면 버린다.
 * 다른 기기에서 측정 중이던(active) 세션은 이 기기에서 이어질 수 없으므로 복구 종료로 바꾼다.
 */
function parseSession(v: unknown, now: number): MeasurementSession | null {
  if (!isObject(v) || !isId(v.id)) return null
  const startedAt = toDate(v.startedAt, now)
  const lastSeenAt = toDate(v.lastSeenAt, now)
  if (!startedAt || !lastSeenAt || lastSeenAt < startedAt) return null
  if (!SESSION_STATUSES.includes(v.status as SessionStatus)) return null

  if (v.status === 'active') {
    if (v.endedAt !== null || v.endReason !== null) return null
    return { id: v.id, startedAt, endedAt: lastSeenAt, status: 'interrupted', endReason: 'recovered', lastSeenAt }
  }

  const endedAt = toDate(v.endedAt, now)
  if (!endedAt || endedAt < startedAt) return null
  if (!END_REASONS.includes(v.endReason as SessionEndReason)) return null
  // 'recovered'는 복구 처리가 interrupted로 바꿀 때만 쓴다
  if (v.endReason === 'recovered' && v.status !== 'interrupted') return null
  return {
    id: v.id,
    startedAt,
    endedAt,
    status: v.status as SessionStatus,
    endReason: v.endReason as SessionEndReason,
    lastSeenAt,
  }
}

function isAutoRecovered(s: MeasurementSession): boolean {
  return s.status === 'interrupted' && s.endReason === 'recovered'
}

/**
 * 같은 id의 세션이 이미 있을 때 파일 쪽으로 바꿀지.
 * 기존 세션이 자동 복구로 끝난 것(측정 중 백업을 먼저 가져온 경우 등)이고, 파일 쪽이 정상 종료됐거나
 * 더 나중까지 측정한 상태면 파일 쪽이 더 정확하다. 그 밖에는 이 기기의 기록을 그대로 둔다.
 */
function shouldReplaceSession(existing: MeasurementSession, incoming: MeasurementSession): boolean {
  if (!isAutoRecovered(existing)) return false
  return !isAutoRecovered(incoming) || incoming.lastSeenAt > existing.lastSeenAt
}

/** 저장된 설정 모양을 검사하고 알려진 필드만 남긴다. 범위를 벗어나면 키 전체를 버린다 */
function sanitizeSettings(v: unknown): Record<string, unknown> | null {
  if (!isObject(v)) return null
  const out: Record<string, unknown> = {}
  if (v.calibrationOffset !== undefined) {
    const o = v.calibrationOffset
    if (typeof o !== 'number' || !Number.isFinite(o) || Math.abs(o) > OFFSET_MAX) return null
    out.calibrationOffset = o
  }
  for (const key of ['morningWindow', 'afternoonWindow'] as const) {
    const w = v[key]
    if (w === undefined) continue
    if (!isObject(w) || !isIntIn(w.startHour, 0, 23) || !isIntIn(w.endHour, 1, 24) || w.startHour >= w.endHour) {
      return null
    }
    out[key] = { startHour: w.startHour, endHour: w.endHour }
  }
  if (v.nudge !== undefined) {
    const n = v.nudge
    if (!isObject(n)) return null
    const nudge: Record<string, unknown> = {}
    if (n.enabled !== undefined) {
      if (typeof n.enabled !== 'boolean') return null
      nudge.enabled = n.enabled
    }
    if (n.maxPerDay !== undefined) {
      if (!isIntIn(n.maxPerDay, 0, 20)) return null
      nudge.maxPerDay = n.maxPerDay
    }
    for (const key of ['cooldownMs', 'sustainMs'] as const) {
      if (n[key] === undefined) continue
      if (!isIntIn(n[key], 0, DAY_MS)) return null
      nudge[key] = n[key]
    }
    for (const key of ['dndStartHour', 'dndEndHour'] as const) {
      if (n[key] === undefined) continue
      if (n[key] !== null && !isIntIn(n[key], 0, 23)) return null
      nudge[key] = n[key]
    }
    out.nudge = nudge
  }
  return out
}

function sanitizeProfile(v: unknown): Record<string, unknown> | null {
  if (!isObject(v) || !Array.isArray(v.reliefs) || v.reliefs.length > 50) return null
  if (!v.reliefs.every((r) => typeof r === 'string' && r.length > 0 && r.length <= 100)) return null
  return { reliefs: [...v.reliefs] }
}

function sanitizeCheckinDay(v: unknown): unknown[] | null {
  if (!Array.isArray(v) || v.length > 10) return null
  const out: unknown[] = []
  for (const e of v) {
    if (!isObject(e) || !CHECKIN_SLOTS.includes(e.slot as string) || !SELF_REPORTS.includes(e.report as string)) {
      return null
    }
    if (typeof e.atMs !== 'number' || !Number.isFinite(e.atMs)) return null
    // context는 읽을 때 loadCheckinEntries가 다시 검사하고, 손상됐으면 버린다
    out.push(isObject(e.context) ? { slot: e.slot, report: e.report, atMs: e.atMs, context: e.context } : { slot: e.slot, report: e.report, atMs: e.atMs })
  }
  return out
}

function sanitizeNudgeDay(v: unknown): Record<string, unknown> | null {
  if (!isObject(v)) return null
  // "오늘은 그만" 은 count를 MAX_SAFE_INTEGER로 저장한다
  if (!isIntIn(v.count, 0, Number.MAX_SAFE_INTEGER)) return null
  if (v.lastAtMs !== null && (typeof v.lastAtMs !== 'number' || !Number.isFinite(v.lastAtMs))) return null
  return { count: v.count, lastAtMs: v.lastAtMs }
}

/**
 * 가져올 수 있는 키면 검사한 값을 저장할 문자열로 돌려준다. 아니면 null.
 * 내보내기는 JSON으로 읽히는 값은 값으로, 아니면 원래 문자열로 담는다.
 */
function sanitizeLocalValue(key: string, value: unknown): string | null {
  let clean: unknown
  if (key === SETTINGS_KEY) clean = sanitizeSettings(value)
  else if (key === PROFILE_KEY) clean = sanitizeProfile(value)
  else if (key === ONBOARDED_KEY) clean = value === true || value === 'true' ? true : null
  else if (DATED_LOCAL_KEY.test(key)) clean = key.startsWith('onmaum_checkin_') ? sanitizeCheckinDay(value) : sanitizeNudgeDay(value)
  else return null
  if (clean === null) return null
  const raw = JSON.stringify(clean)
  return raw.length > MAX_LOCAL_VALUE_LENGTH ? null : raw
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
    const raw = sanitizeLocalValue(key, value)
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
 * 검사를 마친 기록을 이 기기에 합친다. 감정 기록과 세션은 한 트랜잭션으로 넣어, 실패하면 둘 다 넣지 않는다.
 * - 감정 기록은 같은 시각(timestamp)의 기록이 이미 있으면 건너뛴다. 파일 안의 중복도 하나만 넣는다.
 * - 세션은 같은 id가 있으면 건너뛴다. 단, 자동 복구로 끝난 기존 세션은 파일의 더 나중 상태로 바꾼다.
 * - 파일·이 기기 어디에도 없는 세션을 가리키는 감정 기록은 세션 연결만 빼고 넣는다.
 * - localStorage 값은 이 기기에 없는 키만 넣는다(이 기기의 설정을 덮어쓰지 않는다).
 * 측정 중이면 MeasurementActiveError를 던진다.
 */
export async function importPersonalData(parsed: ParsedImport, now: Date = new Date()): Promise<ImportSummary> {
  if (await isMeasurementActive(now)) throw new MeasurementActiveError()

  const summary: ImportSummary = {
    emotions: { added: 0, duplicate: 0, invalid: parsed.invalidEmotions },
    sessions: { added: 0, updated: 0, duplicate: 0, invalid: parsed.invalidSessions },
    localKeys: { added: 0, kept: 0, ignored: parsed.ignoredLocalKeys, failed: 0 },
  }

  await db.transaction('rw', db.emotions, db.sessions, async () => {
    // 세션 먼저: 감정 기록의 세션 연결이 유효한지 판단하는 데 쓴다
    const knownSessionIds = new Set<string>()
    if (parsed.sessions.length > 0) {
      const ids = [...new Set(parsed.sessions.map((s) => s.id))]
      const existing = new Map<string, MeasurementSession>()
      for (const s of await db.sessions.bulkGet(ids)) if (s) existing.set(s.id, s)
      const toPut: MeasurementSession[] = []
      const handled = new Set<string>()
      for (const s of parsed.sessions) {
        knownSessionIds.add(s.id)
        const current = existing.get(s.id)
        if (handled.has(s.id) || (current && !shouldReplaceSession(current, s))) {
          summary.sessions.duplicate += 1
          continue
        }
        handled.add(s.id)
        toPut.push(s)
        if (current) summary.sessions.updated += 1
        else summary.sessions.added += 1
      }
      await db.sessions.bulkPut(toPut)
    }

    if (parsed.emotions.length > 0) {
      // 같은 시각의 기존 기록만 인덱스 키로 찾는다(기존 기록 전체를 읽지 않는다)
      const dates = [...new Set(parsed.emotions.map((e) => e.timestamp.getTime()))].map((t) => new Date(t))
      const existingKeys = await db.emotions.where('timestamp').anyOf(dates).keys()
      const seen = new Set(existingKeys.map((k) => (k as Date).getTime()))

      const referenced = [...new Set(parsed.emotions.map((e) => e.sessionId).filter((id): id is string => !!id))]
      const unknown = referenced.filter((id) => !knownSessionIds.has(id))
      for (const s of await db.sessions.bulkGet(unknown)) if (s) knownSessionIds.add(s.id)

      const toAdd: Omit<EmotionRecord, 'id'>[] = []
      for (const e of parsed.emotions) {
        const key = e.timestamp.getTime()
        if (seen.has(key)) {
          summary.emotions.duplicate += 1
          continue
        }
        seen.add(key)
        if (e.sessionId !== undefined && !knownSessionIds.has(e.sessionId)) {
          const { sessionId: _orphan, ...rest } = e
          void _orphan
          toAdd.push(rest)
        } else {
          toAdd.push(e)
        }
      }
      // id는 이 기기에서 새로 매긴다
      await db.emotions.bulkAdd(toAdd as EmotionRecord[])
      summary.emotions.added = toAdd.length
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
        summary.localKeys.failed += 1
      }
    }
  }

  return summary
}
