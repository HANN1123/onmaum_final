import { describe, it, expect } from 'vitest'
import { normalizeExpressions } from '@/lib/emotion/emotionAnalysis'

describe('normalizeExpressions', () => {
  it('disgust를 angry(적대 정서)에 합친다', () => {
    const r = normalizeExpressions({ happy: 0, neutral: 0, sad: 0, angry: 0.2, disgusted: 0.2 })
    expect(r.angry).toBeCloseTo(1) // (0.2+0.2)/0.4
    expect(r.happy).toBeCloseTo(0)
    expect(r.calm).toBeCloseTo(0)
    expect(r.sad).toBeCloseTo(0)
  })

  it('neutral→calm 매핑 + 합으로 정규화', () => {
    const r = normalizeExpressions({ happy: 1, neutral: 1, sad: 0, angry: 0, disgusted: 0 })
    expect(r.happy).toBeCloseTo(0.5)
    expect(r.calm).toBeCloseTo(0.5)
  })

  it('합이 0이면 calm=1 폴백', () => {
    expect(normalizeExpressions({ happy: 0, neutral: 0, sad: 0, angry: 0, disgusted: 0 })).toEqual({
      happy: 0,
      calm: 1,
      sad: 0,
      angry: 0,
    })
  })
})
