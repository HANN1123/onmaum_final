import type { CheckinSlot } from './checkin'
import { CARE_ACTIONS, DESK_NONE, MIND_NONE, TREAT_NONE, type CareContext } from './careActions'
import { BREATHING_PREFERENCES, type BreathingPreference, type Profile } from '../../../shared/storage/profile'

/**
 * 처음 설문(2026-11). 설문 → 측정 → 피드백 흐름에서, 모든 답이 피드백 어디에 쓰이는지 정해져 있는 것만 묻는다.
 *  1 treat     쉴 때 즐겨 먹거나 마시는 것 → 측정 중 휴식 알림("한숨 돌리고 커피 한 잔")·결과 제안
 *  2 desk      응대 사이 자리에서 할 수 있는 것 → 측정 중 휴식 알림·결과 제안
 *  3 mind      마음이 복잡할 때 도움이 되는 것 → 휴식 알림·결과·하루 리포트 제안
 *  4 breathing 호흡 안내 선호 → 호흡 방법·길이, 받지 않기면 자동 제안에서 뺌
 * 퇴근 후 회복법·여유 시간·말투·상태 확인 시간대는 설문을 짧게 하려고 묻지 않는다(2026-11-09 결정).
 * 프로필의 해당 필드(recoveryActions·breakBudget·tone)는 이전에 저장된 값을 읽기 위해 남겨 두고, 없으면 기본값을 쓴다
 * (여유 시간은 "그때마다 달라요", 말투는 다정하게). 상태 확인 시간대는 기록 화면 "내 설정"에서 바꾼다.
 * 그 뒤 마지막 화면에서 기록 저장·휴식 알림을 한 번 고르고 기억한다(설문 화면이 따로 그린다).
 * 민원 종류·상대·근무지·건강 상태·자유 서술은 묻지 않는다. 선택지의 id 를 저장한다(문구를 고쳐도 데이터는 그대로).
 */

export type CareSurveyStepId = 'treat' | 'desk' | 'mind' | 'breathing'

export interface SurveyChoice {
  id: string
  label: string
  /** 선택지 아래 작은 설명(예: 말투 예시) */
  detail?: string
  /** 고르면 같은 문항의 다른 선택을 지운다("해당 없음") */
  exclusive?: true
}

export interface CareSurveyStep {
  id: CareSurveyStepId
  kind: 'multi' | 'single'
  question: string
  hint: string
  choices: readonly SurveyChoice[]
}

const actionChoices = (context: CareContext): SurveyChoice[] =>
  CARE_ACTIONS.filter((a) => a.context === context).map((a) => ({ id: a.id, label: a.label }))

export type CheckinChoice = 'both' | 'morning' | 'afternoon' | 'off'

export const CARE_SURVEY: readonly CareSurveyStep[] = [
  {
    id: 'treat',
    kind: 'multi',
    question: '쉴 때 즐겨 먹거나\n마시는 것은 무엇인가요?',
    hint: '여러 개 골라도 돼요. 힘든 순간이 이어지면 "한숨 돌리고 커피 한 잔 어때요?"처럼 권해요.',
    choices: [...actionChoices('treat'), { id: TREAT_NONE, label: '딱히 없어요', exclusive: true }],
  },
  {
    id: 'desk',
    kind: 'multi',
    question: '응대 사이, 자리에서\n무엇을 해볼 수 있나요?',
    hint: '여러 개 골라도 돼요. 측정 중 쉬어 가기를 제안할 때 이 중에서 골라요.',
    choices: [...actionChoices('desk'), { id: DESK_NONE, label: '지금은 어려워요', exclusive: true }],
  },
  {
    id: 'mind',
    kind: 'multi',
    question: '마음이 복잡할 때\n무엇이 도움이 되나요?',
    hint: '여러 개 골라도 돼요. 휴식 알림·측정 결과·하루 리포트에서 제안해요.',
    choices: [...actionChoices('mind'), { id: MIND_NONE, label: '잘 모르겠어요', exclusive: true }],
  },
  {
    id: 'breathing',
    kind: 'single',
    question: '호흡 안내는\n어떻게 받고 싶나요?',
    hint: '순환 한숨 호흡은 들이마시고, 한 번 더 짧게 들이마신 뒤 길게 내쉬는 방법이에요. 하루 5분 연습 연구(Balban 외, 2023)를 참고했어요.',
    choices: [
      { id: 'sigh1', label: '순환 한숨 호흡 1분', detail: '응대 사이에 짧게' },
      { id: 'sigh5', label: '쉬는 시간엔 5분', detail: '측정 중에는 1분, 결과·리포트에서는 5분' },
      { id: 'slow1', label: '숨 참기 없는 느린 호흡', detail: '들숨 4초 · 날숨 6초' },
      { id: 'none', label: '호흡 안내는 받지 않을게요' },
    ],
  },
]

export type SurveyAnswers = Record<CareSurveyStepId, string[]>

export function emptyAnswers(): SurveyAnswers {
  return { treat: [], desk: [], mind: [], breathing: [] }
}

/**
 * 선택지를 눌렀을 때의 새 답.
 * - single: 다른 것을 누르면 바꾸고, 고른 것을 다시 누르면 지운다(답하지 않음).
 * - multi: 켜고 끈다. "해당 없음"을 고르면 나머지를 지우고, 다른 것을 고르면 "해당 없음"을 지운다.
 */
export function toggleChoice(step: CareSurveyStep, current: readonly string[], id: string): string[] {
  const on = current.includes(id)
  if (step.kind === 'single') return on ? [] : [id]
  if (on) return current.filter((x) => x !== id)
  const choice = step.choices.find((c) => c.id === id)
  if (choice?.exclusive) return [id]
  const exclusiveIds = new Set(step.choices.filter((c) => c.exclusive).map((c) => c.id))
  return [...current.filter((x) => !exclusiveIds.has(x)), id]
}

export function checkinChoice(slots: Record<CheckinSlot, boolean>): CheckinChoice {
  if (slots.morning && slots.afternoon) return 'both'
  if (slots.morning) return 'morning'
  if (slots.afternoon) return 'afternoon'
  return 'off'
}

export function checkinSlotsFor(choice: CheckinChoice): Record<CheckinSlot, boolean> {
  return { morning: choice === 'both' || choice === 'morning', afternoon: choice === 'both' || choice === 'afternoon' }
}

/** 저장된 프로필로 설문을 다시 열 때의 답. 설문에 답하지 않은 항목은 비워 둔다 */
export function answersFromProfile(profile: Profile | null): SurveyAnswers {
  const answers = emptyAnswers()
  // 빈 목록은 "해당 없음"을 고른 것이다
  const restore = (ids: string[] | undefined, none: string) => (ids ? (ids.length > 0 ? [...ids] : [none]) : [])
  answers.treat = restore(profile?.treats, TREAT_NONE)
  answers.desk = restore(profile?.deskActions, DESK_NONE)
  answers.mind = restore(profile?.mindActions, MIND_NONE)
  if (profile?.breathing) answers.breathing = [profile.breathing]
  return answers
}

function single<T extends string>(answer: readonly string[], allowed: readonly T[]): T | undefined {
  const v = answer[0]
  return v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : undefined
}

/**
 * 설문 답을 저장할 프로필로 바꾼다. 이전 설문 답(reliefs)과 지금 묻지 않는 필드(퇴근 후·여유 시간·말투)는 그대로 둔다.
 * 답하지 않은 문항은 필드를 만들지 않는다. "해당 없음"은 빈 목록으로 저장한다(답은 했음).
 */
export function profileFromAnswers(answers: SurveyAnswers, previous: Profile | null): Profile {
  const profile: Profile = { reliefs: previous?.reliefs ?? [] }
  if (previous?.recoveryActions) profile.recoveryActions = previous.recoveryActions
  if (previous?.breakBudget) profile.breakBudget = previous.breakBudget
  if (previous?.tone) profile.tone = previous.tone
  const actions = (ids: string[], none: string) => ids.filter((id) => id !== none)
  if (answers.treat.length > 0) profile.treats = actions(answers.treat, TREAT_NONE)
  if (answers.desk.length > 0) profile.deskActions = actions(answers.desk, DESK_NONE)
  if (answers.mind.length > 0) profile.mindActions = actions(answers.mind, MIND_NONE)
  const breathing = single<BreathingPreference>(answers.breathing, BREATHING_PREFERENCES)
  if (breathing) profile.breathing = breathing
  return profile
}

/** 고른 답이 하나라도 있는지(마지막 버튼 문구에 쓴다) */
export function answeredCount(answers: SurveyAnswers): number {
  return Object.values(answers).filter((a) => a.length > 0).length
}
