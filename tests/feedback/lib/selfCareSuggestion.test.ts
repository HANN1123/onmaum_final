import { describe, it, expect } from 'vitest'
import { suggestionFor, RELIEF_SUGGESTIONS } from '@/features/feedback/lib/selfCareSuggestion'

describe('suggestionFor', () => {
  it('프로필 선호가 있으면 제안에 반영한다', () => {
    expect(suggestionFor('angry', { reliefs: ['커피'] })).toContain('커피')
    expect(suggestionFor('sad', { reliefs: ['산책'] })).toContain('산책')
  })
  it('프로필이 없으면 감정별 기본 제안', () => {
    expect(suggestionFor('sad', null)).toContain('차')
    expect(suggestionFor('angry', null)).toContain('숨')
  })
  it('reliefs가 비었으면 기본 제안과 동일', () => {
    expect(suggestionFor('happy', { reliefs: [] })).toBe(suggestionFor('happy', null))
  })
  it('단정 어휘를 쓰지 않는다', () => {
    const all = (['calm', 'happy', 'sad', 'angry'] as const).flatMap((e) => [
      suggestionFor(e, null),
      suggestionFor(e, { reliefs: ['커피'] }),
    ])
    for (const s of all) {
      expect(s).not.toMatch(/당신은|불안합니다|화났습니다/)
    }
  })

  it('설문 선택지에는 미리 쓴 문장을 그대로 보여 주고, 감정으로 하루를 단정하는 앞말을 붙이지 않는다', () => {
    for (const e of ['calm', 'happy', 'sad', 'angry'] as const) {
      expect(suggestionFor(e, { reliefs: ['짧은 산책'] })).toBe('잠깐 일어나서 걸어 볼까요?')
    }
  })

  it('옛 선택지 이름으로 저장된 프로필도 새 문장으로 보여 준다', () => {
    expect(suggestionFor('sad', { reliefs: ['좋아하는 명언'] })).toBe(RELIEF_SUGGESTIONS['좋아하는 글귀'])
    expect(suggestionFor('calm', { reliefs: ['커피 한 잔'] })).toBe(RELIEF_SUGGESTIONS['커피'])
  })

  it('문장이 없는 값은 "~ 어때요?"로 만든다', () => {
    expect(suggestionFor('happy', { reliefs: ['산책'] })).toBe('산책 어때요?')
  })

  it('기쁨·평온 기본 제안도 기분을 단정하지 않는다', () => {
    expect(suggestionFor('happy', null)).not.toMatch(/좋은 기분|평온함/)
    expect(suggestionFor('calm', null)).not.toMatch(/좋은 기분|평온함/)
  })
})
