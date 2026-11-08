import { describe, expect, it } from 'vitest'
import {
  answersFromProfile,
  CARE_SURVEY,
  checkinFromAnswers,
  emptyAnswers,
  profileFromAnswers,
  toggleChoice,
} from '@/features/feedback/lib/careSurvey'
import { careAction, DESK_NONE } from '@/features/feedback/lib/careActions'

const step = (id: string) => CARE_SURVEY.find((s) => s.id === id)!

describe('careSurvey: 처음 설문', () => {
  it('행동 선택지는 모두 제안 목록에 있고, 같은 문항 안에서 id 가 겹치지 않는다', () => {
    for (const s of CARE_SURVEY) {
      const idsInStep = s.choices.map((c) => c.id)
      expect(new Set(idsInStep).size).toBe(idsInStep.length)
      if (s.id === 'desk' || s.id === 'recovery') {
        for (const c of s.choices) if (!c.exclusive) expect(careAction(c.id)?.context).toBe(s.id)
      }
    }
  })

  it('복수 선택: "해당 없음"은 다른 선택과 함께 고를 수 없다', () => {
    const desk = step('desk')
    let a = toggleChoice(desk, [], 'water')
    a = toggleChoice(desk, a, 'shoulders')
    expect(a).toEqual(['water', 'shoulders'])
    a = toggleChoice(desk, a, DESK_NONE)
    expect(a).toEqual([DESK_NONE])
    a = toggleChoice(desk, a, 'water')
    expect(a).toEqual(['water'])
    expect(toggleChoice(desk, a, 'water')).toEqual([])
  })

  it('단일 선택: 바꾸면 하나만 남고, 같은 것을 다시 누르면 답하지 않은 상태가 된다', () => {
    const budget = step('budget')
    expect(toggleChoice(budget, ['under30s'], 'about3m')).toEqual(['about3m'])
    expect(toggleChoice(budget, ['about3m'], 'about3m')).toEqual([])
  })

  it('답을 프로필로 바꾸고, 답하지 않은 문항은 필드를 만들지 않는다', () => {
    const answers = { ...emptyAnswers(), desk: [DESK_NONE], recovery: ['walk'], breathing: ['slow1'], checkin: ['morning'] }
    const profile = profileFromAnswers(answers, { reliefs: ['커피'] })
    expect(profile).toEqual({ reliefs: ['커피'], deskActions: [], recoveryActions: ['walk'], breathing: 'slow1' })
    expect(checkinFromAnswers(answers)).toEqual({ morning: true, afternoon: false })
    expect(checkinFromAnswers(emptyAnswers())).toBeNull()
  })

  it('다시 열면 저장된 답을 미리 고른 상태로 보인다("해당 없음" 포함)', () => {
    const answers = answersFromProfile(
      { reliefs: [], deskActions: [], recoveryActions: ['music'], breakBudget: 'over5m', tone: 'plain' },
      { morning: false, afternoon: false },
    )
    expect(answers).toEqual({ desk: [DESK_NONE], recovery: ['music'], budget: ['over5m'], breathing: [], tone: ['plain'], checkin: ['off'] })
  })
})
