import { describe, expect, it } from 'vitest'
import { careSuggestions, suggestionStart } from '@/features/feedback/lib/careActions'
import type { Profile } from '@/shared/storage/profile'

const ids = (p: Profile | null, m: 'during' | 'after' | 'day') => careSuggestions(p, m).map((s) => s.id)

describe('careSuggestions: 설문 답으로 고르는 쉬어 가기 제안', () => {
  const profile: Profile = {
    reliefs: [],
    deskActions: ['water', 'shoulders', 'stillness', 'breathe'],
    recoveryActions: ['walk', 'music'],
    breakBudget: 'about1m',
    breathing: 'sigh5',
    tone: 'warm',
  }

  it('측정 중에는 자리에서 할 수 있는 것과 1분 호흡만, 회복법은 결과·리포트에서만 제안한다', () => {
    expect(ids(profile, 'during')).toEqual(['water', 'shoulders', 'stillness', 'breathing:sigh:60'])
    expect(ids(profile, 'after')).toEqual(['water', 'shoulders', 'stillness', 'walk', 'music', 'breathing:sigh:300'])
    expect(ids(profile, 'day')).toEqual(['walk', 'music', 'breathing:sigh:300'])
  })

  it('여유가 30초 미만이면 더 오래 걸리는 행동과 1분 호흡을 측정 중 후보에서 뺀다', () => {
    const tight = { ...profile, breakBudget: 'under30s' as const, deskActions: ['water', 'breathe'] }
    expect(ids(tight, 'during')).toEqual(['water'])
    // 결과 화면에서는 시간 제한 없이 호흡을 제안한다
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

  it('말투를 고르면 같은 제안을 다른 문장으로 보인다', () => {
    const warm = careSuggestions(profile, 'during')[1].text
    const plain = careSuggestions({ ...profile, tone: 'plain' }, 'during')[1].text
    expect(warm).toBe('어깨에 들어간 힘을 잠깐 풀어 볼까요?')
    expect(plain).toBe('어깨 힘 풀기 · 10초')
  })

  it('답이 없거나 맞는 행동이 없으면 중립 제안을 먼저 두고, 목록은 비지 않는다', () => {
    expect(ids(null, 'during')).toEqual(['fallback:during', 'breathing:sigh:60'])
    const none: Profile = { reliefs: [], deskActions: [], recoveryActions: [], breathing: 'none' }
    expect(ids(none, 'day')).toEqual(['fallback:day'])
  })

  it('이전 설문(문구 저장)만 있으면 첫 답 하나가 아니라 고른 답 모두를 후보로 쓴다', () => {
    const legacy: Profile = { reliefs: ['커피', '짧은 산책', '커피 한 잔', '없는 답'] }
    const list = careSuggestions(legacy, 'after')
    expect(list.map((s) => s.text)).toEqual([
      '커피 한 잔 하며 잠깐 쉬어 가요',
      '잠깐 일어나서 걸어 볼까요?',
      '커피 한 잔 하며 잠깐 쉬어 가요',
      '순환 한숨 호흡으로 1분 숨을 골라 볼까요?',
    ])
  })
})

describe('suggestionStart: 첫 제안 위치', () => {
  it('날짜·화면마다 다르게 시작하고 같은 날 같은 화면은 같다', () => {
    const d = new Date(2026, 10, 9, 10)
    expect(suggestionStart(1, 'after', d)).toBe(0)
    expect(suggestionStart(5, 'after', d)).toBe(suggestionStart(5, 'after', new Date(2026, 10, 9, 18)))
    expect(suggestionStart(5, 'after', d)).not.toBe(suggestionStart(5, 'day', d))
    expect(suggestionStart(5, 'after', new Date(2026, 10, 10))).toBe((suggestionStart(5, 'after', d) + 1) % 5)
  })
})
