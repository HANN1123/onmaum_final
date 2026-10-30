import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactsFooter from '@/features/ui/common/ContactsFooter'

describe('ContactsFooter', () => {
  it('정신건강위기상담 1577-0199와 자살예방상담 109를 보여 준다', () => {
    render(<ContactsFooter />)
    expect(screen.getByText(/1577-0199/)).toBeInTheDocument()
    expect(screen.getByText(/📞 109$/)).toBeInTheDocument()
  })

  it('tel: 링크가 정확하고, 2024년 109로 통합된 옛 번호 1393은 쓰지 않는다', () => {
    const { container } = render(<ContactsFooter />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['tel:1577-0199', 'tel:109'])
    expect(container.textContent).not.toContain('1393')
  })

  it('"도움이 필요하면" 권유 톤 카피 노출', () => {
    render(<ContactsFooter />)
    expect(screen.getByText(/도움이 필요하면/)).toBeInTheDocument()
  })
})
