import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NudgeBanner from '@/features/feedback/components/NudgeBanner'

describe('NudgeBanner', () => {
  it('open=false면 렌더 안 함', () => {
    const { container } = render(
      <NudgeBanner open={false} message="x" onClose={() => {}} onMute={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('open=true면 메시지 + 버튼, 콜백 호출', () => {
    const onClose = vi.fn()
    const onMute = vi.fn()
    render(
      <NudgeBanner open message="잠깐 숨 돌릴까요?" onClose={onClose} onMute={onMute} />,
    )
    expect(screen.getByText('잠깐 숨 돌릴까요?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '나중에' }))
    expect(onClose).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '오늘은 그만' }))
    expect(onMute).toHaveBeenCalled()
  })
})
