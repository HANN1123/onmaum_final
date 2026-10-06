import { describe, it, expect } from 'vitest'
import { suggestionFor } from '@/lib/emotion/selfCareSuggestion'

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
})
