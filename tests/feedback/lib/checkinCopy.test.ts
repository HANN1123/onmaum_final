import { describe, it, expect } from 'vitest'
import { checkinLine } from '@/features/feedback/lib/checkinCopy'

describe('checkinLine', () => {
  it('기준선 있을 때 평소 대비 문구', () => {
    expect(checkinLine('high', 'relative')).toContain('평소보다')
  })
  it('절대 모드 high → 부담 인지 문구 (평소대비 아님)', () => {
    const line = checkinLine('high', 'absolute')
    expect(line).not.toContain('평소보다')
    expect(line.length).toBeGreaterThan(0)
  })
  it('low/typical도 비단정 문구 반환', () => {
    expect(checkinLine('low', 'relative').length).toBeGreaterThan(0)
    expect(checkinLine('typical', 'absolute').length).toBeGreaterThan(0)
  })
})
