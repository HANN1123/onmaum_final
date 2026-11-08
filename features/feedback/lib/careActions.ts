import type { BreakBudget, MessageTone, Profile } from '../../../shared/storage/profile'
import type { BreathingDuration, BreathingTechnique } from './breathing'
import { reliefSentence } from './selfCareSuggestion'

/**
 * 쉬어 가기 제안. 처음 설문(careSurvey.ts)의 답으로 후보를 고르고, 화면은 하나씩 보여 주며 "다른 제안"으로 돌린다.
 * 흐름은 설문 → 측정 → 피드백이다. 측정 중 휴식 알림·측정 결과·하루 리포트가 이 후보를 쓴다.
 *
 * 제안 갈래(설문 문항과 같다)
 * - treat    쉴 때 즐겨 먹거나 마시는 것: "한숨 돌리고 커피 한 잔 어때요?" 처럼 잠깐 쉬는 틈을 권한다.
 *            좋아하는 것을 먹고 마시며 쉬는 시간을 갖는 것 자체를 권하는 것이며, 음식이 스트레스를 줄인다고 말하지 않는다.
 * - desk     응대 사이 자리에서 할 수 있는 몸 풀기
 * - mind     마음이 복잡할 때 도움이 되는 것(사진·글귀·음악 등)
 * - recovery 쉬는 시간·퇴근 후 회복법(걷기·대화·샤워 등)
 * - 호흡 안내(순환 한숨 호흡·느린 호흡)는 여러 제안 중 하나다.
 *
 * 원칙
 * - 고른 답을 모두 후보로 쓴다. 고른 순서를 선호 순위로 보지 않는다.
 * - 언제 보이는지(moment)에 맞는 것만 고른다. 측정 중에는 여유 시간 안에 끝나는 것만, 걷기·샤워 같은 회복법은
 *   결과·하루 리포트에서 "쉬는 시간이나 퇴근 후"로만 제안한다.
 * - 측정 중 휴식 알림(상태가 높게 이어질 때)은 먹거리를 골랐으면 그것부터 권한다("한숨 돌리고 …").
 * - 호흡 안내를 받지 않기로 했으면 자동 제안에서 뺀다(사용자가 직접 여는 것은 막지 않는다).
 * - 표정·점수로 기분을 단정하는 앞말을 붙이지 않는다.
 */

export type CareContext = 'treat' | 'desk' | 'mind' | 'recovery'

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
  // 쉴 때 즐겨 먹거나 마시는 것(이전 설문 첫 문항과 같은 선택지)
  { id: 'coffee', context: 'treat', label: '커피', seconds: 60, warm: '한숨 돌리고 커피 한 잔 어때요?', plain: '커피 한 잔' },
  { id: 'tea', context: 'treat', label: '따뜻한 차', seconds: 60, warm: '따뜻한 차 한 잔 마시며 잠깐 쉬어 가요', plain: '따뜻한 차 한 잔' },
  { id: 'water', context: 'treat', label: '시원한 물', seconds: 20, warm: '시원한 물 한 잔 마시고 갈까요?', plain: '물 한 잔' },
  { id: 'sweets', context: 'treat', label: '달달한 간식', seconds: 60, warm: '달달한 간식 하나 먹으며 쉬어 가요', plain: '달달한 간식 하나' },
  { id: 'soda', context: 'treat', label: '탄산음료', seconds: 30, warm: '탄산음료 한 모금으로 기분 전환 어때요?', plain: '탄산음료 한 모금' },
  { id: 'fruit', context: 'treat', label: '과일', seconds: 60, warm: '과일 조금 먹으며 쉬어 가요', plain: '과일 조금' },
  // 응대 사이 자리에서
  { id: 'shoulders', context: 'desk', label: '어깨·목 풀기', seconds: 20, warm: '어깨와 목에 들어간 힘을 잠깐 풀어 볼까요?', plain: '어깨·목 풀기 · 10초' },
  { id: 'stretch', context: 'desk', label: '기지개 켜기', seconds: 15, warm: '자리에서 기지개 한 번 쭉 켜 볼까요?', plain: '기지개 한 번' },
  { id: 'farLook', context: 'desk', label: '먼 곳 바라보기', seconds: 20, warm: '화면에서 눈을 떼고 먼 곳을 잠깐 바라봐요', plain: '먼 곳 20초 바라보기' },
  { id: 'eyesClosed', context: 'desk', label: '잠깐 눈 감기', seconds: 30, warm: '잠깐 눈을 감고 쉬어 가요', plain: '30초 눈 감기' },
  { id: 'stillness', context: 'desk', label: '잠깐 조용히 있기', seconds: 30, warm: '다음 응대 전에 잠깐 조용히 있어도 괜찮아요', plain: '30초 조용히 있기' },
  { id: 'breathe', context: 'desk', label: '천천히 숨 고르기', seconds: 60, warm: '1분만 숨을 골라 볼까요?', plain: '호흡 1분', breathing: true },
  // 마음이 복잡할 때
  { id: 'photo', context: 'mind', label: '좋아하는 사진 보기', seconds: 30, warm: '좋아하는 사진 한 장 꺼내 볼까요?', plain: '좋아하는 사진 한 장' },
  { id: 'quote', context: 'mind', label: '좋아하는 글귀', seconds: 30, warm: '좋아하는 글귀를 한 번 떠올려 봐요', plain: '좋아하는 글귀 떠올리기' },
  { id: 'music', context: 'mind', label: '음악 한 곡', seconds: 200, warm: '좋아하는 음악 한 곡 들어 볼까요?', plain: '음악 한 곡' },
  { id: 'blank', context: 'mind', label: '멍하니 쉬기', seconds: 60, warm: '아무것도 하지 않고 잠깐 멍하니 쉬어 봐요', plain: '1분 멍하니 쉬기' },
  { id: 'petPlant', context: 'mind', label: '반려동물·식물 보기', seconds: 30, warm: '반려동물이나 식물을 잠깐 바라봐요', plain: '반려동물·식물 보기' },
  { id: 'scent', context: 'mind', label: '좋아하는 향', seconds: 30, warm: '좋아하는 향을 맡으며 잠깐 쉬어 가요', plain: '좋아하는 향 맡기' },
  // 쉬는 시간·퇴근 후
  { id: 'walk', context: 'recovery', label: '가볍게 걷기', seconds: 600, warm: '쉬는 시간에 잠깐 걸어 볼까요?', plain: '쉬는 시간 · 가볍게 걷기' },
  { id: 'talk', context: 'recovery', label: '편한 사람과 대화', seconds: 600, warm: '편한 사람과 잠깐 이야기 나눠 볼까요?', plain: '편한 사람과 대화' },
  { id: 'rest', context: 'recovery', label: '조용히 쉬기', seconds: 900, warm: '퇴근 후에는 조용히 쉬는 시간을 가져 봐요', plain: '퇴근 후 · 조용히 쉬기' },
  { id: 'shower', context: 'recovery', label: '따뜻한 샤워', seconds: 900, warm: '오늘은 따뜻한 물로 씻고 푹 쉬어요', plain: '퇴근 후 · 따뜻한 샤워' },
  { id: 'sleepEarly', context: 'recovery', label: '일찍 잠들기', seconds: 900, warm: '오늘은 조금 일찍 쉬어 봐요', plain: '오늘은 일찍 자기' },
]

/** 다른 선택과 함께 고를 수 없는 "해당 없음" 선택지 id */
export const TREAT_NONE = 'treatNone'
export const DESK_NONE = 'deskNone'
export const MIND_NONE = 'mindNone'
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

export type CareKind = CareContext | 'breathing' | 'fallback' | 'legacy'

export interface CareSuggestion {
  id: string
  kind: CareKind
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
    if (text) list.push({ id: `legacy:${r}`, kind: 'legacy', text, breathing: null })
  }
  return list
}

function hasNewAnswers(profile: Profile | null): boolean {
  if (!profile) return false
  return profile.treats !== undefined || profile.deskActions !== undefined || profile.mindActions !== undefined
    || profile.recoveryActions !== undefined || profile.breakBudget !== undefined || profile.breathing !== undefined
    || profile.tone !== undefined
}

/** 답이 없거나 조건에 맞는 것이 하나도 없을 때의 중립 제안 */
const FALLBACK: Record<CareMoment, { warm: string; plain: string }> = {
  during: { warm: '잠깐 화면에서 눈을 떼고 어깨를 풀어 봐요', plain: '눈 떼고 어깨 풀기' },
  after: { warm: '다음 일로 넘어가기 전에 잠깐 쉬어 가요', plain: '잠깐 쉬어 가기' },
  day: { warm: '퇴근 후에는 나에게 맞는 쉬는 시간을 조금 챙겨 봐요', plain: '퇴근 후 쉬는 시간 챙기기' },
}

/** moment 별로 쓰는 갈래. 순서가 목록 순서다 */
const CONTEXTS_BY_MOMENT: Record<CareMoment, CareContext[]> = {
  during: ['treat', 'desk', 'mind'],
  after: ['treat', 'desk', 'mind', 'recovery'],
  day: ['recovery', 'mind', 'treat'],
}

function idsFor(profile: Profile, context: CareContext): string[] {
  if (context === 'treat') return profile.treats ?? []
  if (context === 'desk') return profile.deskActions ?? []
  if (context === 'mind') return profile.mindActions ?? []
  return profile.recoveryActions ?? []
}

/**
 * moment 에 맞는 제안 후보 목록. 비어 있지 않다(맞는 것이 없으면 중립 제안 하나 + 호흡).
 * - during(측정 중 휴식 알림): 먹거리·자리에서·마음 돌보기 중 여유 시간 안에 끝나는 것 + 1분 호흡
 * - after(측정 결과): 먹거리·자리에서·마음 돌보기·쉬는 시간/퇴근 후 + 호흡
 * - day(하루 리포트): 쉬는 시간/퇴근 후·마음 돌보기·먹거리 + 호흡(5분을 골랐으면 5분)
 */
export function careSuggestions(profile: Profile | null, moment: CareMoment): CareSuggestion[] {
  const tone: MessageTone = profile?.tone ?? 'warm'
  const plan = breathingPlan(profile, moment)
  const budget = BUDGET_SEC[profile?.breakBudget ?? 'varies']
  const list: CareSuggestion[] = []

  if (profile && !hasNewAnswers(profile)) {
    list.push(...legacySuggestions(profile))
  } else if (profile) {
    for (const context of CONTEXTS_BY_MOMENT[moment]) {
      for (const id of idsFor(profile, context)) {
        const a = careAction(id)
        if (!a || a.context !== context || a.breathing) continue // 호흡은 아래 호흡 후보 하나로 합친다
        if (moment === 'during' && a.seconds > budget) continue
        list.push({ id: a.id, kind: a.context, text: a[tone], breathing: null })
      }
    }
  }

  // 호흡: 받지 않기가 아니면 넣는다. 측정 중에는 여유 시간이 1분이 안 되면 뺀다
  if (plan && (moment !== 'during' || budget >= 60)) {
    list.push({ id: `breathing:${plan.technique}:${plan.durationSec}`, kind: 'breathing', text: breathingText(plan, tone), breathing: plan })
  }

  if (list.every((s) => s.breathing !== null)) {
    list.unshift({ id: `fallback:${moment}`, kind: 'fallback', text: FALLBACK[moment][tone], breathing: null })
  }
  return list
}

function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

/**
 * 처음 보여 줄 후보 위치. 날짜와 화면마다 다르게 시작해, 매번 첫 답만 보이지 않게 한다.
 * 같은 날 같은 화면에서는 같은 제안으로 시작한다(새로고침할 때마다 바뀌지 않게).
 * 측정 중 휴식 알림은 먹거리를 골랐으면 그중 하나로 시작한다("한숨 돌리고 커피 한 잔").
 */
export function suggestionStart(list: readonly CareSuggestion[], moment: CareMoment, date: Date): number {
  if (list.length <= 1) return 0
  const day = dayNumber(date)
  if (moment === 'during') {
    const treats = list.map((s, i) => (s.kind === 'treat' ? i : -1)).filter((i) => i >= 0)
    if (treats.length > 0) return treats[day % treats.length]
  }
  const offset = moment === 'during' ? 0 : moment === 'after' ? 1 : 2
  return (day + offset) % list.length
}
