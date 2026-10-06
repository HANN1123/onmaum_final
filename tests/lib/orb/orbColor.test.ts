import { describe, it, expect } from 'vitest'
import {
  EMOTION_HUES,
  EMOTION_SHADES,
  rgbString,
  topTwoEmotions,
  gradientColors,
  accumulatedColor,
  washBackground,
} from '@/lib/orb/orbColor'

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

describe('orbColor 기본', () => {
  it('감정 기준색 (평온=시안·슬픔=인디고로 분리)', () => {
    expect(EMOTION_HUES.happy).toEqual([245, 183, 46])
    expect(EMOTION_HUES.calm).toEqual([46, 169, 208])
    expect(EMOTION_HUES.sad).toEqual([90, 111, 176])
    expect(EMOTION_HUES.angry).toEqual([229, 75, 53])
  })
  it('rgbString', () => {
    expect(rgbString([1, 2, 3])).toBe('rgb(1,2,3)')
  })
  it('상위 2개 감정 (지배·차순)', () => {
    expect(topTwoEmotions({ happy: 0.6, calm: 0.1, sad: 0.1, angry: 0.2 })).toEqual(['happy', 'angry'])
    expect(topTwoEmotions({ happy: 0.1, calm: 0.1, sad: 0.5, angry: 0.3 })).toEqual(['sad', 'angry'])
  })
})

describe('orbColor 혼합', () => {
  it('상위2 그라데이션 (from=지배, to=차순)', () => {
    const g = gradientColors({ happy: 0.6, calm: 0.1, sad: 0.1, angry: 0.2 })
    expect(g.from).toBe('rgb(245,183,46)') // happy
    expect(g.to).toBe('rgb(229,75,53)') // angry
  })
  it('누적 "내 색" — 단일 감정', () => {
    expect(accumulatedColor({ happy: 1, calm: 0, sad: 0, angry: 0 })).toBe('rgb(245,183,46)')
  })
  it('누적 "내 색" — 가중 블렌드', () => {
    // happy[245,183,46]·calm[46,169,208] 0.5씩 → ([245+46]/2, [183+169]/2, [46+208]/2)
    expect(accumulatedColor({ happy: 0.5, calm: 0.5, sad: 0, angry: 0 })).toBe('rgb(146,176,127)')
  })
  it('누적 "내 색" — 전부 0이면 평온색 폴백', () => {
    expect(accumulatedColor({ happy: 0, calm: 0, sad: 0, angry: 0 })).toBe('rgb(46,169,208)')
  })
})

describe('washBackground (PIP 감정 워시)', () => {
  it('dominant 감정 색을 흰색과 섞은 옅은 radial 워시 (평온)', () => {
    // calm(46,169,208) dominant → 위 tint(0.92), 아래 tint(0.74)
    expect(washBackground({ happy: 0, calm: 1, sad: 0, angry: 0 })).toBe(
      'radial-gradient(circle at 50% 28%, rgb(238,248,251) 0%, rgb(201,233,243) 90%)',
    )
  })
  it('dominant이 바뀌면 워시 색도 바뀐다', () => {
    const calm = washBackground({ happy: 0, calm: 1, sad: 0, angry: 0 })
    const angry = washBackground({ happy: 0, calm: 0, sad: 0, angry: 1 })
    expect(angry).not.toBe(calm)
    expect(angry.startsWith('radial-gradient(circle at 50% 28%')).toBe(true)
  })
})

describe('EMOTION_SHADES (단색 구체 — light/mid/dark)', () => {
  const ORDER = ['happy', 'calm', 'sad', 'angry'] as const

  it('mid(c2)는 canonical EMOTION_HUES와 일치 (전사 검증)', () => {
    for (const e of ORDER) {
      expect(hexToRgb(EMOTION_SHADES[e].c2)).toEqual([...EMOTION_HUES[e]])
    }
  })
  it('각 감정에 light·mid·dark·glow·shadow가 모두 정의됨', () => {
    for (const e of ORDER) {
      const s = EMOTION_SHADES[e]
      expect(Boolean(s.c1 && s.c2 && s.c3 && s.glow && s.shadow)).toBe(true)
    }
  })
})
