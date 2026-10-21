import { db, type EmotionRecord, type MeasurementSession } from './db'
import { loadSettings, SETTINGS_KEY } from './settings'
import { PROFILE_KEY } from './profile'

/** 내보내기 파일 형식 버전. DB schema 버전과 맞춘다 */
export const EXPORT_SCHEMA_VERSION = 2

const KEY_PREFIX = 'onmaum_'
const ONBOARDED_KEY = 'onmaum_onboarded'
/** 지워도 기록이 아닌 사용자 선택이라 기본 삭제에서 남기는 키 */
const PREFERENCE_KEYS = [SETTINGS_KEY, PROFILE_KEY, ONBOARDED_KEY]

export interface DateRange {
  start: Date
  end: Date
}

export interface PersonalRecords {
  emotions: EmotionRecord[]
  sessions: MeasurementSession[]
}

export interface PersonalDataExport extends PersonalRecords {
  schemaVersion: number
  /** ISO 8601 */
  exportedAt: string
  /** localStorage의 onmaum_ 키. JSON으로 읽히면 값, 아니면 원래 문자열 */
  localData: Record<string, unknown>
}

export interface DeleteOptions {
  /** true면 설정·설문 답변·온보딩 여부까지 지운다 */
  includePreferences?: boolean
}

/** 로컬 자정부터 23:59:59.999까지 */
export function dayRange(date: Date): DateRange {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** 월요일 0시부터 일요일 23:59:59.999까지 */
export function weekRange(date: Date): DateRange {
  const start = new Date(date)
  const fromMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - fromMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** 기간 안의 감정 기록(timestamp 기준)과 세션(startedAt 기준)을 시간순으로 */
export async function getPersonalRecordsByRange(start: Date, end: Date): Promise<PersonalRecords> {
  const [emotions, sessions] = await Promise.all([
    db.emotions.where('timestamp').between(start, end, true, true).sortBy('timestamp'),
    db.sessions.where('startedAt').between(start, end, true, true).sortBy('startedAt'),
  ])
  return { emotions, sessions }
}

function onmaumKeys(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(KEY_PREFIX)) keys.push(k)
    }
    return keys
  } catch {
    return []
  }
}

function readLocalData(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of onmaumKeys()) {
    const raw = localStorage.getItem(k)
    if (raw === null) continue
    try {
      out[k] = JSON.parse(raw)
    } catch {
      out[k] = raw
    }
  }
  return out
}

/** 기기에 저장된 개인 기록 전체. 파일 저장은 화면에서 하고, 서버로 보내지 않는다 */
export async function exportPersonalData(now: Date = new Date()): Promise<PersonalDataExport> {
  const [emotions, sessions] = await Promise.all([
    db.emotions.orderBy('timestamp').toArray(),
    db.sessions.orderBy('startedAt').toArray(),
  ])
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    emotions,
    sessions,
    localData: readLocalData(),
  }
}

export function serializeExport(data: PersonalDataExport): string {
  return JSON.stringify(data, null, 2)
}

/** 측정이 진행 중이라 지금 지우면 기록이 다시 생길 수 있을 때 */
export class MeasurementActiveError extends Error {
  constructor() {
    super('측정이 진행 중입니다')
    this.name = 'MeasurementActiveError'
  }
}

/** 기록을 지웠지만 기기 저장소 일부를 지우지 못했을 때 */
export class PartialDeleteError extends Error {
  constructor(readonly remainingKeys: string[]) {
    super('일부 기록을 지우지 못했습니다')
    this.name = 'PartialDeleteError'
  }
}

/** 이 시간 안에 감정 기록이 저장됐거나 세션이 갱신됐으면 측정 중으로 본다 (1분 집계 주기의 2배) */
export const MEASUREMENT_ACTIVE_WINDOW_MS = 2 * 60 * 1000

/**
 * 이 기기 어느 탭에서든 측정이 진행 중인지 추정한다.
 * 갱신이 최근인 active 세션이 있거나, 최근 감정 기록이 있으면 true.
 */
export async function isMeasurementActive(now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - MEASUREMENT_ACTIVE_WINDOW_MS)
  const active = await db.sessions.where('status').equals('active').toArray()
  if (active.some((s) => s.lastSeenAt >= since)) return true
  return (await db.emotions.where('timestamp').aboveOrEqual(since).count()) > 0
}

/**
 * 측정 기록(감정·세션)과 체크인·넛지 기록을 지운다.
 * 기본은 설정·설문·온보딩 여부를 남기지만, 체크인으로 쌓인 보정값은 기록에서 나온 값이므로 0으로 되돌린다.
 * 측정 중이면 MeasurementActiveError, 기기 저장소 일부를 지우지 못하면 PartialDeleteError를 던진다.
 */
export async function deleteAllPersonalData(
  options: DeleteOptions = {},
  now: Date = new Date(),
): Promise<void> {
  const { includePreferences = false } = options
  if (await isMeasurementActive(now)) throw new MeasurementActiveError()

  await db.transaction('rw', db.emotions, db.sessions, async () => {
    await db.emotions.clear()
    await db.sessions.clear()
  })

  const targets = onmaumKeys().filter((k) => includePreferences || !PREFERENCE_KEYS.includes(k))
  try {
    for (const k of targets) localStorage.removeItem(k)
    if (!includePreferences && localStorage.getItem(SETTINGS_KEY) !== null) {
      // saveSettings는 실패를 무시하므로 직접 써서 실패를 알 수 있게 한다
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), calibrationOffset: 0 }))
    }
  } catch {
    // 아래 확인에서 남은 키로 실패를 알린다
  }

  const remaining = onmaumKeys().filter((k) => targets.includes(k))
  const offsetLeft = !includePreferences && loadSettings().calibrationOffset !== 0
  if (remaining.length > 0 || offsetLeft) {
    throw new PartialDeleteError(offsetLeft ? [...remaining, SETTINGS_KEY] : remaining)
  }
}
