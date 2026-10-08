import { describe, it, expect } from 'vitest'
import { updateSustain, shouldNudge, type NudgeSettings, type NudgeDayState } from '@/features/feedback/lib/nudge'

const settings: NudgeSettings = {
  enabled: true,
  maxPerDay: 2,
  cooldownMs: 90 * 60 * 1000,
  sustainMs: 5 * 60 * 1000,
  dndStartHour: null,
  dndEndHour: null,
}
const fresh: NudgeDayState = { count: 0, lastAtMs: null }
const now = new Date('2026-06-12T14:00:00')
const sustained = { level: 'high' as const, highSinceMs: now.getTime() - 6 * 60 * 1000 }

describe('updateSustain', () => {
  it('high 진입 시각 유지, 미달 시 null', () => {
    const t = 1000
    const a = updateSustain(null, 'high', t)
    expect(a.highSinceMs).toBe(t)
    const b = updateSustain(a, 'veryHigh', t + 500)
    expect(b.highSinceMs).toBe(t) // 진입 시각 유지
    const c = updateSustain(b, 'typical', t + 800)
    expect(c.highSinceMs).toBeNull() // 떨어지면 리셋
  })
})

describe('shouldNudge', () => {
  it('모든 조건 충족 → true', () => {
    expect(shouldNudge({ settings, sustain: sustained, dayState: fresh, now })).toBe(true)
  })
  it('토글 off → false', () => {
    expect(shouldNudge({ settings: { ...settings, enabled: false }, sustain: sustained, dayState: fresh, now })).toBe(false)
  })
  it('지속 미달 → false', () => {
    const short = { level: 'high' as const, highSinceMs: now.getTime() - 60 * 1000 }
    expect(shouldNudge({ settings, sustain: short, dayState: fresh, now })).toBe(false)
  })
  it('high 아님 → false', () => {
    expect(shouldNudge({ settings, sustain: { level: 'typical', highSinceMs: null }, dayState: fresh, now })).toBe(false)
  })
  it('빈도 상한 초과 → false', () => {
    expect(shouldNudge({ settings, sustain: sustained, dayState: { count: 2, lastAtMs: null }, now })).toBe(false)
  })
  it('쿨다운 미경과 → false', () => {
    const recent = { count: 1, lastAtMs: now.getTime() - 30 * 60 * 1000 }
    expect(shouldNudge({ settings, sustain: sustained, dayState: recent, now })).toBe(false)
  })
  it('방해금지 시간대 → false', () => {
    const dnd = { ...settings, dndStartHour: 13, dndEndHour: 15 }
    expect(shouldNudge({ settings: dnd, sustain: sustained, dayState: fresh, now })).toBe(false)
  })
  it('자정 넘는 방해금지(22~6시)', () => {
    const night = { ...settings, dndStartHour: 22, dndEndHour: 6 }
    const at23 = new Date('2026-06-12T23:00:00')
    const s = { level: 'high' as const, highSinceMs: at23.getTime() - 6 * 60 * 1000 }
    expect(shouldNudge({ settings: night, sustain: s, dayState: fresh, now: at23 })).toBe(false)
  })
})
