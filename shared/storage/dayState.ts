import type { CheckinSlot } from '../../features/feedback/lib/checkin'
import type { SelfReport } from '../../features/algorithm/baseline/calibration'
import type { NudgeDayState } from '../../features/feedback/lib/nudge'
import type { BaselineMode, StressLevel } from '../../features/algorithm/baseline/baseline'

/**
 * 체크인 당시 사용자에게 보여 준 판정과 그 근거.
 * 나중에 보정 규칙을 실제 응답으로 검증할 때 쓴다 (docs/architecture/CALIBRATION_DESIGN.md).
 */
export interface CheckinContext {
  level: StressLevel
  /** 최근 30분 부정 정서 원값 */
  recentStress: number
  /** 보정값을 더한 값 (0~100) */
  adjusted: number
  mode: BaselineMode
  baselineN: number | null
  /** 이번 응답으로 바뀌기 전 보정값 */
  offsetBefore: number
}

export interface CheckinEntry {
  slot: CheckinSlot
  report: SelfReport
  atMs: number
  /** 이 필드가 생기기 전에 저장된 기록에는 없다 */
  context?: CheckinContext
}

const checkinKey = (date: string) => `onmaum_checkin_${date}`
const nudgeKey = (date: string) => `onmaum_nudge_${date}`

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 무시
  }
}

const SLOTS: readonly string[] = ['morning', 'afternoon']
const REPORTS: readonly string[] = ['agree', 'worse', 'better']
const LEVELS: readonly string[] = ['low', 'typical', 'high', 'veryHigh']
const MODES: readonly string[] = ['absolute', 'relative']

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function toContext(v: unknown): CheckinContext | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const c = v as Record<string, unknown>
  const ok =
    LEVELS.includes(c.level as string) &&
    MODES.includes(c.mode as string) &&
    isFiniteNumber(c.recentStress) &&
    isFiniteNumber(c.adjusted) &&
    isFiniteNumber(c.offsetBefore) &&
    (c.baselineN === null || isFiniteNumber(c.baselineN))
  return ok ? (c as unknown as CheckinContext) : undefined
}

/**
 * 그 날짜의 체크인 기록. 슬롯·응답·시각이 맞지 않는 항목은 건너뛴다.
 * context만 손상됐으면 응답은 남기고 context를 버린다.
 */
export function loadCheckinEntries(date: string): CheckinEntry[] {
  const raw = readJson<unknown>(checkinKey(date), [])
  if (!Array.isArray(raw)) return []
  const out: CheckinEntry[] = []
  for (const e of raw) {
    if (typeof e !== 'object' || e === null) continue
    const r = e as Record<string, unknown>
    if (!SLOTS.includes(r.slot as string) || !REPORTS.includes(r.report as string) || !isFiniteNumber(r.atMs)) {
      continue
    }
    const entry: CheckinEntry = { slot: r.slot as CheckinSlot, report: r.report as SelfReport, atMs: r.atMs }
    const context = toContext(r.context)
    if (context) entry.context = context
    out.push(entry)
  }
  return out
}

export function loadCheckinDone(date: string): CheckinSlot[] {
  return loadCheckinEntries(date).map((e) => e.slot)
}

export function saveCheckinEntry(
  date: string,
  slot: CheckinSlot,
  report: SelfReport,
  atMs: number,
  context?: CheckinContext,
): void {
  const entries = loadCheckinEntries(date).filter((e) => e.slot !== slot)
  entries.push(context ? { slot, report, atMs, context } : { slot, report, atMs })
  writeJson(checkinKey(date), entries)
}

export function loadNudgeDayState(date: string): NudgeDayState {
  const raw = readJson<Partial<NudgeDayState>>(nudgeKey(date), {})
  const count = typeof raw?.count === 'number' ? raw.count : 0
  const lastAtMs = typeof raw?.lastAtMs === 'number' ? raw.lastAtMs : null
  return { count, lastAtMs }
}

export function saveNudgeDayState(date: string, state: NudgeDayState): void {
  writeJson(nudgeKey(date), state)
}
