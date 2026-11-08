import { describe, expect, it } from 'vitest'
import { careSuggestions, suggestionStart } from '@/features/feedback/lib/careActions'
import type { Profile } from '@/shared/storage/profile'

const ids = (p: Profile | null, m: 'during' | 'after' | 'day') => careSuggestions(p, m).map((s) => s.id)

describe('careSuggestions: 설문 답으로 고르는 쉬어 가기 제안', () => {
  const profile: Profile = {
    reliefs: [],
    treats: ['coffee', 'water'],
    deskActions: ['shoulders', 'eyesClosed', 'breathe'],
    mindActions: ['photo', 'music'],
    recoveryActions: ['walk', 'talk'],
    breakBudget: 'about1m',
    breathing: 'sigh5',
    tone: 'warm',
  }

  it('측정 중에는 먹거리·자리에서·마음 돌보기(여유 시간 안) + 1분 호흡, 회복법은 결과·리포트에서만', () => {
    // 음악 한 곡(200초)은 1분 여유를 넘어 측정 중에는 빠진다
    expect(ids(profile, 'during')).toEqual(['coffee', 'water', 'shoulders', 'eyesClosed', 'photo', 'breathing:sigh:60'])
    expect(ids(profile, 'after')).toEqual(['coffee', 'water', 'shoulders', 'eyesClosed', 'photo', 'music', 'walk', 'talk', 'breathing:sigh:300'])
    expect(ids(profile, 'day')).toEqual(['walk', 'talk', 'photo', 'music', 'coffee', 'water', 'breathing:sigh:300'])
  })

  it('커피 같은 먹거리는 "한숨 돌리고" 쉬는 틈을 권하는 문장으로 보인다', () => {
    const coffee = careSuggestions(profile, 'during')[0]
    expect(coffee).toMatchObject({ kind: 'treat', text: '한숨 돌리고 커피 한 잔 어때요?', breathing: null })
    expect(careSuggestions({ ...profile, tone: 'plain' }, 'during')[0].text).toBe('커피 한 잔')
  })

  it('여유가 30초 미만이면 더 오래 걸리는 것과 1분 호흡을 측정 중 후보에서 뺀다', () => {
    const tight = { ...profile, breakBudget: 'under30s' as const }
    expect(ids(tight, 'during')).toEqual(['water', 'shoulders', 'eyesClosed', 'photo'])
    expect(ids(tight, 'after')).toContain('breathing:sigh:300')
  })

  it('호흡 안내를 받지 않기로 했으면 자동 제안에서 호흡을 뺀다', () => {
    const noBreath = { ...profile, breathing: 'none' as const }
    expect(ids(noBreath, 'during').some((id) => id.startsWith('breathing'))).toBe(false)
    expect(ids(noBreath, 'day').some((id) => id.startsWith('breathing'))).toBe(false)
  })

  it('느린 호흡을 고르면 느린 호흡으로 안내한다', () => {
    const slow = careSuggestions({ ...profile, breathing: 'slow1' }, 'during').at(-1)!
    expect(slow.breathing).toEqual({ technique: 'slow', durationSec: 60 })
    expect(slow.text).toContain('느린 호흡')
  })

  it('답이 없거나 맞는 것이 없으면 중립 제안을 먼저 두고, 목록은 비지 않는다', () => {
    expect(ids(null, 'during')).toEqual(['fallback:during', 'breathing:sigh:60'])
    const none: Profile = { reliefs: [], treats: [], deskActions: [], mindActions: [], recoveryActions: [], breathing: 'none' }
    expect(ids(none, 'day')).toEqual(['fallback:day'])
  })

  it('이전 설문(문구 저장)만 있으면 첫 답 하나가 아니라 고른 답 모두를 후보로 쓴다', () => {
    const legacy: Profile = { reliefs: ['커피', '짧은 산책', '커피 한 잔', '없는 답'] }
    expect(careSuggestions(legacy, 'after').map((s) => s.text)).toEqual([
      '커피 한 잔 하며 잠깐 쉬어 가요',
      '잠깐 일어나서 걸어 볼까요?',
      '커피 한 잔 하며 잠깐 쉬어 가요',
      '순환 한숨 호흡으로 1분 숨을 골라 볼까요?',
    ])
  })
})

describe('suggestionStart: 첫 제안 위치', () => {
  const profile: Profile = { reliefs: [], treats: ['coffee', 'tea'], deskActions: ['shoulders', 'stretch'], mindActions: ['photo'] }

  it('측정 중 휴식 알림은 먹거리를 골랐으면 그중 하나로 시작한다', () => {
    const list = careSuggestions(profile, 'during')
    for (let d = 1; d <= 4; d += 1) {
      expect(list[suggestionStart(list, 'during', new Date(2026, 10, d))].kind).toBe('treat')
    }
  })

  it('결과·리포트는 날짜·화면마다 다르게 시작하고 같은 날 같은 화면은 같다', () => {
    const list = careSuggestions(profile, 'after')
    const d = new Date(2026, 10, 9, 10)
    expect(suggestionStart(list.slice(0, 1), 'after', d)).toBe(0)
    expect(suggestionStart(list, 'after', d)).toBe(suggestionStart(list, 'after', new Date(2026, 10, 9, 18)))
    expect(suggestionStart(list, 'after', new Date(2026, 10, 10))).toBe((suggestionStart(list, 'after', d) + 1) % list.length)
  })
})
