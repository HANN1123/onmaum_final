import { describe, it, expect } from 'vitest'
import { EMOTION_CAPTIONS, pickCaption } from '@/features/ui/orb/lib/orbCaption'
import { EMOTION_ORDER } from '@/features/algorithm/emotion/emotionAnalysis'

describe('orbCaption', () => {
  it('감정마다 여러 개의 토스 톤 변형이 있다(지루함 방지)', () => {
    for (const e of EMOTION_ORDER) {
      expect(EMOTION_CAPTIONS[e].length).toBeGreaterThanOrEqual(2)
    }
  })
  it('단정 어휘를 쓰지 않는다(주어=마음, 비단정)', () => {
    for (const variants of Object.values(EMOTION_CAPTIONS)) {
      for (const c of variants) {
        expect(c).not.toMatch(/당신은|불안합니다|화났습니다/)
      }
    }
  })
  it('pickCaption — rng 주입으로 변형 선택(결정적)', () => {
    expect(pickCaption('calm', () => 0)).toBe(EMOTION_CAPTIONS.calm[0])
    expect(pickCaption('calm', () => 0.999)).toBe(
      EMOTION_CAPTIONS.calm[EMOTION_CAPTIONS.calm.length - 1],
    )
  })
  it('pickCaption — 기본 rng도 변형 중 하나를 반환', () => {
    expect(EMOTION_CAPTIONS.happy).toContain(pickCaption('happy'))
  })
})
