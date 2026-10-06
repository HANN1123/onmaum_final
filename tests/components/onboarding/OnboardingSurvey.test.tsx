import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OnboardingSurvey from '@/components/onboarding/OnboardingSurvey'
import { loadProfile } from '@/lib/storage/profile'

describe('OnboardingSurvey (wizard)', () => {
  beforeEach(() => localStorage.clear())

  it('첫 화면에 step1 질문이 보인다', () => {
    render(<OnboardingSurvey />)
    expect(screen.getByText(/마시거나/)).toBeTruthy()
  })

  it('선택 후 끝까지 진행하면 reliefs 저장 + onDone 호출', () => {
    const onDone = vi.fn()
    render(<OnboardingSurvey onDone={onDone} />)
    // step1 선택
    fireEvent.click(screen.getByRole('button', { name: /커피 한 잔/ }))
    // 4단계: 다음을 마지막 직전까지 누른 뒤 시작하기
    const STEP_COUNT = 4
    for (let i = 0; i < STEP_COUNT - 1; i++) {
      fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    }
    fireEvent.click(screen.getByRole('button', { name: /시작/ }))
    expect(onDone).toHaveBeenCalled()
    expect(loadProfile()?.reliefs).toContain('커피 한 잔')
  })
})
