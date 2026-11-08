import type { BreakBudget, MessageTone, Profile } from '../../../shared/storage/profile'
import type { BreathingDuration, BreathingTechnique } from './breathing'
import { reliefSentence } from './selfCareSuggestion'

/**
 * 쉬어 가기 제안. 처음 설문(careSurvey.ts)의 답으로 후보를 고르고, 화면은 하나씩 보여 주며 "다른 제안"으로 돌린다.
 *
 * 원칙
 * - 고른 답을 모두 후보로 쓴다. 고른 순서를 선호 순위로 보지 않는다.
 * - 언제 보이는지(moment)에 맞는 행동만 고른다. 측정 중·응대 사이에는 자리에서 할 수 있는 것만,
 *   걷기·샤워 같은 회복법은 결과·하루 리포트에서 "쉬는 시간이나 퇴근 후"로만 제안한다.
 * - 평소 여유 시간보다 오래 걸리는 행동은 측정 중 후보에서 뺀다.
 * - 호흡 안내를 받지 않기로 했으면 자동 제안에서 뺀다(사용자가 직접 여는 것은 막지 않는다).
 * - 카페인·간식은 기본 후보에 두지 않는다. 표정·점수로 기분을 단정하는 앞말을 붙이지 않는다.
 */

export type CareContext = 'desk' | 'recovery'

export interface CareAction {
  id: string
  context: CareContext
  /** 설문 선택지 문구 */
  label: string
  /** 대략 걸리는 시간(초). 측정 중 후보를 여유 시간으로 거른다 */
  seconds: number
  /** 다정한 말투 */
  warm: string
  /** 짧고 담백한 말투 */
  plain: string
  /** 호흡 안내를 여는 행동 */
  breathing?: true
}

export const CARE_ACTIONS: readonly CareAction[] = [
  { id: 'water', context: 'desk', label: '물 한 모금', seconds: 20, warm: '물 한 모금 마시고 갈까요?', plain: '물 한 모금' },
  { id: 'shoulders', context: 'desk', label: '어깨 힘 풀기', seconds: 20, warm: '어깨에 들어간 힘을 잠깐 풀어 볼까요?', plain: '어깨 힘 풀기 · 10초' },
  { id: 'farLook', context: 'desk', label: '먼 곳 바라보기', seconds: 20, warm: '화면에서 눈을 떼고 먼 곳을 잠깐 바라봐요', plain: '먼 곳 20초 바라보기' },
  { id: 'stillness', context: 'desk', label: '잠깐 조용히 있기', seconds: 30, warm: '다음 응대 전에 잠깐 조용히 있어도 괜찮아요', plain: '30초 조용히 있기' },
  { id: 'breathe', context: 'desk', label: '천천히 숨 고르기', seconds: 60, warm: '1분만 숨을 골라 볼까요?', plain: '호흡 1분', breathing: true },
  { id: 'walk', context: 'recovery', label: '가볍게 걷기', seconds: 600, warm: '쉬는 시간에 잠깐 걸어 볼까요?', plain: '쉬는 시간 · 가볍게 걷기' },
  { id: 'music', context: 'recovery', label: '음악 듣기', seconds: 240, warm: '쉬는 시간에 좋아하는 음악 한 곡 어때요?', plain: '쉬는 시간 · 음악 한 곡' },
  { id: 'rest', context: 'recovery', label: '조용히 쉬기', seconds: 900, warm: '퇴근 후에는 조용히 쉬는 시간을 가져 봐요', plain: '퇴근 후 · 조용히 쉬기' },
  { id: 'talk', context: 'recovery', label: '편한 사람과 대화', seconds: 600, warm: '편한 사람과 잠깐 이야기 나눠 볼까요?', plain: '편한 사람과 대화' },
  { id: 'shower', context: 'recovery', label: '따뜻한 샤워', seconds: 900, warm: '오늘은 따뜻한 물로 씻고 푹 쉬어요', plain: '퇴근 후 · 따뜻한 샤워' },
]

/** 다른 선택과 함께 고를 수 없는 "해당 없음" 선택지 id */
export const DESK_NONE = 'deskNone'
export const RECOVERY_NONE = 'recoveryNone'

const ACTION_BY_ID = new Map(CARE_ACTIONS.map((a) => [a.id, a]))

export function careAction(id: string): CareAction | undefined {
  return ACTION_BY_ID.get(id)
}

/** 측정 중·응대 사이에 쓸 수 있는 최대 시간(초) */
const BUDGET_SEC: Record<BreakBudget, number> = {
  under30s: 30,
  about1m: 70,
  about3m: 180,
  over5m: 600,
  varies: 70,
}

export type CareMoment = 'during' | 'after' | 'day'

export interface BreathingPlan {
  technique: BreathingTechnique
  durationSec: BreathingDuration
}

export interface CareSuggestion {
  id: string
  text: string
  /** 있으면 화면이 "따라 하기" 버튼으로 호흡 안내를 연다 */
  breathing: BreathingPlan | null
}

function breathingPlan(profile: Profile | null, moment: CareMoment): BreathingPlan | null {
  const pref = profile?.breathing
  if (pref === 'none') return null
  const technique: BreathingTechnique = pref === 'slow1' ? 'slow' : 'sigh'
  // 5분은 확보된 휴식 시간에만: 측정 중에는 1분으로 줄인다
  const durationSec: BreathingDuration = pref === 'sigh5' && moment !== 'during' ? 300 : 60
  return { technique, durationSec }
}

function breathingText(plan: BreathingPlan, tone: MessageTone): string {
  const minutes = plan.durationSec / 60
  const name = plan.technique === 'sigh' ? '순환 한숨 호흡' : '느린 호흡'
  return tone === 'plain' ? `${name} ${minutes}분` : `${name}으로 ${minutes}분 숨을 골라 볼까요?`
}

/** 이전 설문(문구 저장)만 있는 프로필: 고른 답 모두를 이전 문장으로 쓴다 */
function legacySuggestions(profile: Profile): CareSuggestion[] {
  const list: CareSuggestion[] = []
  for (const r of profile.reliefs) {
    const text = reliefSentence(r)
    if (text) list.push({ id: `legacy:${r}`, text, breathing: null })
  }
  return list
}

function hasNewAnswers(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.deskActions !== undefined || profile.recoveryActions !== undefined
    || profile.breakBudget !== undefined || profile.breathing !== undefined || profile.tone !== undefined
}

/** 답이 없거나 조건에 맞는 것이 하나도 없을 때의 중립 제안 */
const FALLBACK: Record<CareMoment, { warm: string; plain: string }> = {
  during: { warm: '잠깐 화면에서 눈을 떼고 어깨를 풀어 봐요', plain: '눈 떼고 어깨 풀기' },
  after: { warm: '다음 일로 넘어가기 전에 잠깐 쉬어 가요', plain: '잠깐 쉬어 가기' },
  day: { warm: '퇴근 후에는 나에게 맞는 쉬는 시간을 조금 챙겨 봐요', plain: '퇴근 후 쉬는 시간 챙기기' },
}

/**
 * moment 에 맞는 제안 후보 목록. 비어 있지 않다(맞는 것이 없으면 중립 제안 하나 + 호흡).
 * - during(측정 중 휴식 알림): 자리에서 할 수 있는 것 중 여유 시간 안에 끝나는 것 + 1분 호흡
 * - after(측정 결과): 자리에서 할 수 있는 것 + 호흡 + 쉬는 시간·퇴근 후 회복법
 * - day(하루 리포트): 쉬는 시간·퇴근 후 회복법 + 호흡(5분을 골랐으면 5분)
 */
export function careSuggestions(profile: Profile | null, moment: CareMoment): CareSuggestion[] {
  const tone: MessageTone = profile?.tone ?? 'warm'
  const plan = breathingPlan(profile, moment)
  const list: CareSuggestion[] = []

  if (profile && !hasNewAnswers(profile)) {
    list.push(...legacySuggestions(profile))
  } else if (profile) {
    const budget = BUDGET_SEC[profile.breakBudget ?? 'varies']
    const desk = (profile.deskActions ?? []).map(careAction).filter((a): a is CareAction => a?.context === 'desk')
    const recovery = (profile.recoveryActions ?? []).map(careAction).filter((a): a is CareAction => a?.context === 'recovery')
    if (moment !== 'day') {
      for (const a of desk) {
        if (a.breathing) continue // 호흡은 아래 호흡 후보 하나로 합친다
        if (moment === 'during' && a.seconds > budget) continue
        list.push({ id: a.id, text: a[tone], breathing: null })
      }
    }
    if (moment !== 'during') {
      for (const a of recovery) list.push({ id: a.id, text: a[tone], breathing: null })
    }
  }

  // 호흡: 받지 않기가 아니면 넣는다. 측정 중에는 여유 시간이 1분이 안 되면 뺀다
  const budgetOk = moment !== 'during' || BUDGET_SEC[profile?.breakBudget ?? 'varies'] >= 60
  if (plan && budgetOk) list.push({ id: `breathing:${plan.technique}:${plan.durationSec}`, text: breathingText(plan, tone), breathing: plan })

  if (list.every((s) => s.breathing !== null)) {
    list.unshift({ id: `fallback:${moment}`, text: FALLBACK[moment][tone], breathing: null })
  }
  return list
}

/**
 * 처음 보여 줄 후보 위치. 날짜와 화면마다 다르게 시작해, 매번 첫 답만 보이지 않게 한다.
 * 같은 날 같은 화면에서는 같은 제안으로 시작한다(새로고침할 때마다 바뀌지 않게).
 */
export function suggestionStart(length: number, moment: CareMoment, date: Date): number {
  if (length <= 1) return 0
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
  const offset = moment === 'during' ? 0 : moment === 'after' ? 1 : 2
  return (day + offset) % length
}
