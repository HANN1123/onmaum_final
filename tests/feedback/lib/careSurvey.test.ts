import { describe, expect, it } from 'vitest'
import {
  answersFromProfile,
  CARE_SURVEY,
  emptyAnswers,
  profileFromAnswers,
  toggleChoice,
} from '@/features/feedback/lib/careSurvey'
import { careAction, DESK_NONE, MIND_NONE } from '@/features/feedback/lib/careActions'

const step = (id: string) => CARE_SURVEY.find((s) => s.id === id)!

describe('careSurvey: 처음 설문', () => {
  it('먹거리·자리에서·마음 돌보기·호흡 4문항만 묻는다', () => {
    expect(CARE_SURVEY.map((s) => s.id)).toEqual(['treat', 'desk', 'mind', 'breathing'])
  })

  it('먹거리 문항이 처음이고 이전 설문의 음료·간식 선택지를 그대로 둔다', () => {
    expect(CARE_SURVEY[0].choices.map((c) => c.label)).toEqual(['커피', '따뜻한 차', '시원한 물', '달달한 간식', '탄산음료', '과일', '딱히 없어요'])
  })

  it('화면 문구에 "체크인"이라는 말을 쓰지 않는다', () => {
    for (const s of CARE_SURVEY) expect(s.question + ' ' + s.hint).not.toContain('체크인')
  })

  it('행동 선택지는 모두 제안 목록에 있고, 같은 문항 안에서 id 가 겹치지 않는다', () => {
    for (const s of CARE_SURVEY) {
      const idsInStep = s.choices.map((c) => c.id)
      expect(new Set(idsInStep).size).toBe(idsInStep.length)
      if (s.id !== 'breathing') {
        for (const c of s.choices) if (!c.exclusive) expect(careAction(c.id)?.context).toBe(s.id)
      }
    }
  })

  it('복수 선택: "해당 없음"은 다른 선택과 함께 고를 수 없다', () => {
    const desk = step('desk')
    let a = toggleChoice(desk, [], 'stretch')
    a = toggleChoice(desk, a, 'shoulders')
    expect(a).toEqual(['stretch', 'shoulders'])
    a = toggleChoice(desk, a, DESK_NONE)
    expect(a).toEqual([DESK_NONE])
    a = toggleChoice(desk, a, 'stretch')
    expect(a).toEqual(['stretch'])
    expect(toggleChoice(desk, a, 'stretch')).toEqual([])
  })

  it('단일 선택: 바꾸면 하나만 남고, 같은 것을 다시 누르면 답하지 않은 상태가 된다', () => {
    const breathing = step('breathing')
    expect(toggleChoice(breathing, ['sigh1'], 'slow1')).toEqual(['slow1'])
    expect(toggleChoice(breathing, ['slow1'], 'slow1')).toEqual([])
  })

  it('답을 프로필로 바꾸고, 답하지 않은 문항은 필드를 만들지 않으며, 지금 묻지 않는 필드는 그대로 둔다', () => {
    const answers = { ...emptyAnswers(), treat: ['coffee', 'sweets'], desk: [DESK_NONE], mind: ['quote'] }
    const profile = profileFromAnswers(answers, { reliefs: ['커피'], recoveryActions: ['walk'], tone: 'plain' })
    expect(profile).toEqual({ reliefs: ['커피'], recoveryActions: ['walk'], tone: 'plain', treats: ['coffee', 'sweets'], deskActions: [], mindActions: ['quote'] })
  })

  it('다시 열면 저장된 답을 미리 고른 상태로 보인다("해당 없음" 포함)', () => {
    const answers = answersFromProfile({ reliefs: [], treats: ['tea'], mindActions: [], breathing: 'sigh5' })
    expect(answers).toEqual({ treat: ['tea'], desk: [], mind: [MIND_NONE], breathing: ['sigh5'] })
  })
})
