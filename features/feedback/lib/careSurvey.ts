import type { CheckinSlot } from './checkin'
import { CARE_ACTIONS, DESK_NONE, RECOVERY_NONE } from './careActions'
import {
  BREAK_BUDGETS,
  BREATHING_PREFERENCES,
  MESSAGE_TONES,
  type BreakBudget,
  type BreathingPreference,
  type MessageTone,
  type Profile,
} from '../../../shared/storage/profile'

/**
 * 처음 설문(2026-11). 모든 답이 피드백 어디에 쓰이는지 정해져 있는 것만 묻는다.
 *  1 desk      응대 사이 자리에서 할 수 있는 것 → 측정 중 휴식 알림·결과 제안
 *  2 recovery  쉬는 시간·퇴근 후 도움이 되는 것 → 결과·하루 리포트 제안
 *  3 budget    응대 사이 여유 시간 → 측정 중 제안을 시간으로 거름(30초 미만이면 1분 호흡 제외)
 *  4 breathing 호흡 안내 선호 → 호흡 방법·길이, 받지 않기면 자동 제안에서 뺌
 *  5 tone      말투 → 같은 제안을 다정하게/짧게
 *  6 checkin   체크인 시간대 → 끈 시간대는 묻지 않음
 * 그 뒤 마지막 화면에서 기록 저장·휴식 알림을 한 번 고르고 기억한다(설문 화면이 따로 그린다).
 * 민원 종류·상대·근무지·건강 상태·자유 서술은 묻지 않는다. 선택지의 id 를 저장한다(문구를 고쳐도 데이터는 그대로).
 */

export type CareSurveyStepId = 'desk' | 'recovery' | 'budget' | 'breathing' | 'tone' | 'checkin'

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

const actionChoices = (context: 'desk' | 'recovery'): SurveyChoice[] =>
  CARE_ACTIONS.filter((a) => a.context === context).map((a) => ({ id: a.id, label: a.label }))

export type CheckinChoice = 'both' | 'morning' | 'afternoon' | 'off'

export const CARE_SURVEY: readonly CareSurveyStep[] = [
  {
    id: 'desk',
    kind: 'multi',
    question: '응대 사이, 자리에서\n무엇을 해볼 수 있나요?',
    hint: '여러 개 골라도 돼요. 측정 중 쉬어 가기를 제안할 때 이 중에서 골라요.',
    choices: [...actionChoices('desk'), { id: DESK_NONE, label: '지금은 어려워요', exclusive: true }],
  },
  {
    id: 'recovery',
    kind: 'multi',
    question: '쉬는 시간이나 퇴근 후\n무엇이 도움이 되나요?',
    hint: '여러 개 골라도 돼요. 측정 결과와 하루 리포트에서 제안해요.',
    choices: [...actionChoices('recovery'), { id: RECOVERY_NONE, label: '아직 잘 모르겠어요', exclusive: true }],
  },
  {
    id: 'budget',
    kind: 'single',
    question: '응대 사이에 보통\n얼마나 여유가 있나요?',
    hint: '여유 시간보다 오래 걸리는 것은 측정 중에 제안하지 않아요.',
    choices: [
      { id: 'under30s', label: '30초 미만' },
      { id: 'about1m', label: '1분 정도' },
      { id: 'about3m', label: '3분 정도' },
      { id: 'over5m', label: '5분 이상' },
      { id: 'varies', label: '그때마다 달라요' },
    ],
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
  {
    id: 'tone',
    kind: 'single',
    question: '제안은 어떤 말투가\n편한가요?',
    hint: '같은 제안을 고른 말투로 보여 드려요.',
    choices: [
      { id: 'warm', label: '다정하게', detail: '“어깨에 들어간 힘을 잠깐 풀어 볼까요?”' },
      { id: 'plain', label: '짧고 담백하게', detail: '“어깨 힘 풀기 · 10초”' },
    ],
  },
  {
    id: 'checkin',
    kind: 'single',
    question: '지금 상태가 맞는지 묻는\n체크인, 언제 할까요?',
    hint: '측정 기록으로 본 최근 30분 상태가 맞는지 묻고, 답을 다음 판정에 조금씩 반영해요. 리포트 화면에서만 물어요.',
    choices: [
      { id: 'both', label: '오전·오후 모두', detail: '10–12시 · 15–17시' },
      { id: 'morning', label: '오전만', detail: '10–12시' },
      { id: 'afternoon', label: '오후만', detail: '15–17시' },
      { id: 'off', label: '묻지 않기' },
    ],
  },
]

export type SurveyAnswers = Record<CareSurveyStepId, string[]>

export function emptyAnswers(): SurveyAnswers {
  return { desk: [], recovery: [], budget: [], breathing: [], tone: [], checkin: [] }
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

/** 저장된 프로필·체크인 설정으로 설문을 다시 열 때의 답. 설문에 답하지 않은 항목은 비워 둔다 */
export function answersFromProfile(profile: Profile | null, checkinSlots: Record<CheckinSlot, boolean> | null): SurveyAnswers {
  const answers = emptyAnswers()
  // 빈 목록은 "해당 없음"을 고른 것이다
  if (profile?.deskActions) answers.desk = profile.deskActions.length > 0 ? [...profile.deskActions] : [DESK_NONE]
  if (profile?.recoveryActions) answers.recovery = profile.recoveryActions.length > 0 ? [...profile.recoveryActions] : [RECOVERY_NONE]
  if (profile?.breakBudget) answers.budget = [profile.breakBudget]
  if (profile?.breathing) answers.breathing = [profile.breathing]
  if (profile?.tone) answers.tone = [profile.tone]
  if (checkinSlots) answers.checkin = [checkinChoice(checkinSlots)]
  return answers
}

function single<T extends string>(answer: readonly string[], allowed: readonly T[]): T | undefined {
  const v = answer[0]
  return v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : undefined
}

/**
 * 설문 답을 저장할 프로필로 바꾼다. 이전 설문 답(reliefs)은 그대로 둔다(옛 화면 호환).
 * 답하지 않은 문항은 필드를 만들지 않는다. "해당 없음"은 빈 목록으로 저장한다(답은 했음).
 */
export function profileFromAnswers(answers: SurveyAnswers, previous: Profile | null): Profile {
  const profile: Profile = { reliefs: previous?.reliefs ?? [] }
  const actions = (ids: string[], none: string) => ids.filter((id) => id !== none)
  if (answers.desk.length > 0) profile.deskActions = actions(answers.desk, DESK_NONE)
  if (answers.recovery.length > 0) profile.recoveryActions = actions(answers.recovery, RECOVERY_NONE)
  const budget = single<BreakBudget>(answers.budget, BREAK_BUDGETS)
  if (budget) profile.breakBudget = budget
  const breathing = single<BreathingPreference>(answers.breathing, BREATHING_PREFERENCES)
  if (breathing) profile.breathing = breathing
  const tone = single<MessageTone>(answers.tone, MESSAGE_TONES)
  if (tone) profile.tone = tone
  return profile
}

/** 체크인 문항 답. 답하지 않았으면 null(설정을 바꾸지 않는다) */
export function checkinFromAnswers(answers: SurveyAnswers): Record<CheckinSlot, boolean> | null {
  const v = single<CheckinChoice>(answers.checkin, ['both', 'morning', 'afternoon', 'off'])
  return v ? checkinSlotsFor(v) : null
}

/** 고른 답이 하나라도 있는지(마지막 버튼 문구에 쓴다) */
export function answeredCount(answers: SurveyAnswers): number {
  return Object.values(answers).filter((a) => a.length > 0).length
}
