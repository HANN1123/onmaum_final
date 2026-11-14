export const PROFILE_KEY = 'onmaum_profile'

/** 응대 사이 평소 여유 시간 */
export type BreakBudget = 'under30s' | 'about1m' | 'about3m' | 'over5m' | 'varies'
/** 호흡 안내 선호. none 이면 자동 제안에서 호흡을 빼고, 사용자가 직접 열 때만 보인다 */
export type BreathingPreference = 'sigh1' | 'sigh5' | 'slow1' | 'none'
/** 제안 문구의 말투 */
export type MessageTone = 'warm' | 'plain'

export const BREAK_BUDGETS: readonly BreakBudget[] = ['under30s', 'about1m', 'about3m', 'over5m', 'varies']
export const BREATHING_PREFERENCES: readonly BreathingPreference[] = ['sigh1', 'sigh5', 'slow1', 'none']
export const MESSAGE_TONES: readonly MessageTone[] = ['warm', 'plain']

/**
 * 로컬 프로필 — 처음 설문 결과. 데이터는 기기에만(서버 없음).
 * - reliefs: 이전 설문(문구 그대로 저장)의 답. 기존 데이터 호환용으로 남긴다.
 * - 2026-11 설문부터는 선택지의 고정 id 를 저장한다(문구를 고쳐도 데이터는 그대로).
 *   treats·deskActions·mindActions·recoveryActions 는 features/feedback/lib/careActions.ts 의 id 다.
 * 답하지 않은 항목은 필드가 없다(미응답을 '받지 않기'로 해석하지 않는다).
 */
export interface Profile {
  reliefs: string[]
  /** 쉴 때 즐겨 먹거나 마시는 것 */
  treats?: string[]
  /** 응대 사이 자리에서 해볼 수 있는 것 */
  deskActions?: string[]
  /** 마음이 복잡할 때 도움이 되는 것 */
  mindActions?: string[]
  /** 휴식 시간·퇴근 후 도움이 되는 것 */
  recoveryActions?: string[]
  breakBudget?: BreakBudget
  breathing?: BreathingPreference
  tone?: MessageTone
}

const MAX_IDS = 20

function idList(v: unknown): string[] | undefined {
  if (!Array.isArray(v) || v.length > MAX_IDS) return undefined
  return v.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 40) ? [...(v as string[])] : undefined
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined
}

/**
 * 저장값·가져온 값을 같은 규칙으로 검사한다. reliefs 가 문자열 배열이 아니면 프로필 전체를 버리고,
 * 새 필드는 잘못된 것만 뺀다(이전 버전 앱이 저장한 프로필도 그대로 읽힌다).
 */
export function sanitizeProfileValue(parsed: unknown): Profile | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const p = parsed as Record<string, unknown>
  if (!Array.isArray(p.reliefs) || p.reliefs.length > 50) return null
  if (!p.reliefs.every((r) => typeof r === 'string' && r.length > 0 && r.length <= 100)) return null
  const profile: Profile = { reliefs: [...(p.reliefs as string[])] }
  const treats = idList(p.treats)
  if (treats) profile.treats = treats
  const desk = idList(p.deskActions)
  if (desk) profile.deskActions = desk
  const mind = idList(p.mindActions)
  if (mind) profile.mindActions = mind
  const recovery = idList(p.recoveryActions)
  if (recovery) profile.recoveryActions = recovery
  const budget = oneOf(p.breakBudget, BREAK_BUDGETS)
  if (budget) profile.breakBudget = budget
  const breathing = oneOf(p.breathing, BREATHING_PREFERENCES)
  if (breathing) profile.breathing = breathing
  const tone = oneOf(p.tone, MESSAGE_TONES)
  if (tone) profile.tone = tone
  return profile
}

export function loadProfile(): Profile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return sanitizeProfileValue(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveProfile(profile: Profile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // 저장 불가 환경은 조용히 무시 (프라이버시: 서버 폴백 없음)
  }
}
