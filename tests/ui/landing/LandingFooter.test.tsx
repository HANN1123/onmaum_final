import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import LandingFooter from '@/features/ui/landing/LandingFooter'

describe('LandingFooter', () => {
  it('상담 전화는 1577-0199와 자살예방상담 109로 안내하고 옛 번호 1393은 쓰지 않는다', () => {
    const { container } = render(<LandingFooter />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['tel:1577-0199', 'tel:109'])
    expect(container.textContent).toContain('자살예방')
    expect(container.textContent).not.toContain('1393')
  })
})
