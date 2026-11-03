import { describe, it, expect } from 'vitest'
import { smoothEmotion } from '@/features/algorithm/emotion/emotionSmoothing'

describe('smoothEmotion', () => {
  it('이전 값이 없으면 새 값을 그대로 쓴다', () => {
    const next = { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 }
    expect(smoothEmotion(null, next)).toEqual(next)
  })

  it('α 0.4로 새 값 쪽으로 다가가고 합은 1을 유지한다', () => {
    const r = smoothEmotion({ happy: 0, calm: 1, sad: 0, angry: 0 }, { happy: 0, calm: 0, sad: 1, angry: 0 })
    expect(r.calm).toBeCloseTo(0.6)
    expect(r.sad).toBeCloseTo(0.4)
    expect(r.happy + r.calm + r.sad + r.angry).toBeCloseTo(1)
  })

  it('한 프레임만 튄 값은 우세 감정을 바로 바꾸지 못한다', () => {
    const steady = { happy: 0.05, calm: 0.8, sad: 0.1, angry: 0.05 }
    const spike = { happy: 0, calm: 0.1, sad: 0.05, angry: 0.85 }
    const r = smoothEmotion(steady, spike)
    expect(r.calm).toBeGreaterThan(r.angry)
  })
})
