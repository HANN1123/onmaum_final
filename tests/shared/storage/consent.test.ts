import { afterEach, describe, expect, it } from 'vitest'
import { CONSENT_KEY, loadConsent, saveConsent } from '@/shared/storage/consent'

afterEach(() => localStorage.clear())

describe('기록 저장 동의', () => {
  it('고르기 전에는 null, 고른 값은 시각과 함께 기억한다', () => {
    expect(loadConsent()).toBeNull()
    expect(saveConsent(true, new Date('2026-11-09T01:00:00.000Z'))).toBe(true)
    expect(loadConsent()).toEqual({ version: 1, record: true, decidedAt: '2026-11-09T01:00:00.000Z' })
    saveConsent(false)
    expect(loadConsent()?.record).toBe(false)
  })

  it('손상된 값은 고르지 않은 것으로 본다', () => {
    localStorage.setItem(CONSENT_KEY, '{"version":1,"record":"yes"}')
    expect(loadConsent()).toBeNull()
    localStorage.setItem(CONSENT_KEY, 'not json')
    expect(loadConsent()).toBeNull()
  })
})
