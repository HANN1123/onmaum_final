import { describe, it, expect, beforeEach } from 'vitest'
import { isOnboarded, markOnboarded, ONBOARDED_KEY } from '@/shared/storage/onboarding'

beforeEach(() => {
  localStorage.clear()
})

describe('처음 설문 완료 기록', () => {
  it('기록이 없으면 설문 전이다', () => {
    expect(isOnboarded()).toBe(false)
  })

  it('마치면 옛 측정 화면과 같은 키에 true 를 남긴다', () => {
    markOnboarded()
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe('true')
    expect(ONBOARDED_KEY).toBe('onmaum_onboarded')
    expect(isOnboarded()).toBe(true)
  })
})
