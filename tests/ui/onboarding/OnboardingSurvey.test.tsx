import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OnboardingSurvey, { SURVEY_STEPS } from '@/features/ui/onboarding/OnboardingSurvey'
import { RELIEF_SUGGESTIONS } from '@/features/feedback/lib/selfCareSuggestion'
import { loadProfile } from '@/shared/storage/profile'

describe('OnboardingSurvey (wizard)', () => {
  beforeEach(() => localStorage.clear())

  it('첫 화면에 step1 질문이 보인다', () => {
    render(<OnboardingSurvey />)
    expect(screen.getByText(/즐겨 먹거나 마시는/)).toBeTruthy()
  })

  it('선택 후 끝까지 진행하면 reliefs 저장 + onDone 호출', () => {
    const onDone = vi.fn()
    render(<OnboardingSurvey onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /커피/ }))
    for (let i = 0; i < SURVEY_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    }
    fireEvent.click(screen.getByRole('button', { name: /개로 시작하기/ }))
    expect(onDone).toHaveBeenCalled()
    expect(loadProfile()?.reliefs).toEqual(['커피'])
  })

  it('어느 단계에서든 설문을 마치고 시작할 수 있고, 그때까지 고른 답은 저장된다', () => {
    const onDone = vi.fn()
    render(<OnboardingSurvey onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /커피/ }))
    fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    fireEvent.click(screen.getByRole('button', { name: /짧은 산책/ }))
    expect(screen.getByText(/지금까지 선택한 답은 저장돼요/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '설문 마치고 시작하기' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(loadProfile()?.reliefs).toEqual(['커피', '짧은 산책'])
  })

  it('아무것도 고르지 않고 첫 단계에서 바로 마쳐도 빈 응답으로 시작한다', () => {
    const onDone = vi.fn()
    render(<OnboardingSurvey onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: '설문 마치고 시작하기' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(loadProfile()?.reliefs).toEqual([])
  })

  it('마지막 단계에서는 시작 버튼이 같은 역할을 하므로 "설문 마치고 시작하기"를 따로 두지 않는다', () => {
    render(<OnboardingSurvey />)
    for (let i = 0; i < SURVEY_STEPS.length - 1; i++) {
      fireEvent.click(screen.getByRole('button', { name: /다음/ }))
    }
    expect(screen.queryByRole('button', { name: '설문 마치고 시작하기' })).toBeNull()
    expect(screen.getByRole('button', { name: '건너뛰고 시작하기' })).toBeTruthy()
  })

  it('모든 선택지에 리포트 제안 문장이 준비되어 있다 (고정 문장에 끼워 넣어 어색해지지 않게)', () => {
    const labels = SURVEY_STEPS.flatMap((s) => s.options.map((o) => o.label))
    const missing = labels.filter((label) => !(label in RELIEF_SUGGESTIONS))
    expect(missing).toEqual([])
  })
})
