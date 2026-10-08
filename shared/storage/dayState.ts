import type { CheckinSlot } from '../../features/feedback/lib/checkin'
import type { SelfReport } from '../../features/algorithm/baseline/calibration'
import type { NudgeDayState } from '../../features/feedback/lib/nudge'

export interface CheckinEntry {
  slot: CheckinSlot
  report: SelfReport
  atMs: number
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

export function loadCheckinDone(date: string): CheckinSlot[] {
  const entries = readJson<unknown>(checkinKey(date), [])
  if (!Array.isArray(entries)) return []
  return entries
    .filter(
      (e): e is CheckinEntry =>
        typeof e === 'object' && e !== null && typeof (e as { slot?: unknown }).slot === 'string',
    )
    .map((e) => e.slot)
}

export function saveCheckinEntry(
  date: string,
  slot: CheckinSlot,
  report: SelfReport,
  atMs: number,
): void {
  const entries = readJson<CheckinEntry[]>(checkinKey(date), []).filter((e) => e.slot !== slot)
  entries.push({ slot, report, atMs })
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
