import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CheckInCard from '@/features/feedback/components/CheckInCard'

describe('CheckInCard', () => {
  it('한 줄 카피와 1탭 버튼 표시', () => {
    render(<CheckInCard slot="morning" line="마음에 힘이 좀 들어가 있었네요" onReport={() => {}} />)
    expect(screen.getByText('마음에 힘이 좀 들어가 있었네요')).toBeTruthy()
    expect(screen.getByRole('button', { name: '맞아요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '지금은 좀 달라요' })).toBeTruthy()
  })

  it("'맞아요' → onReport('agree')", () => {
    const onReport = vi.fn()
    render(<CheckInCard slot="morning" line="x" onReport={onReport} />)
    fireEvent.click(screen.getByRole('button', { name: '맞아요' }))
    expect(onReport).toHaveBeenCalledWith('agree')
  })

  it("'달라요' → 방향 2지선다 노출 → 'worse'/'better'", () => {
    const onReport = vi.fn()
    render(<CheckInCard slot="afternoon" line="x" onReport={onReport} />)
    fireEvent.click(screen.getByRole('button', { name: '지금은 좀 달라요' }))
    fireEvent.click(screen.getByRole('button', { name: '더 힘들었어요' }))
    expect(onReport).toHaveBeenCalledWith('worse')
  })
})
