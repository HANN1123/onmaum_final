import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactsFooter from '@/components/common/ContactsFooter'

describe('ContactsFooter', () => {
  it('1577-0199, 1393 텍스트 노출', () => {
    render(<ContactsFooter />)
    expect(screen.getByText(/1577-0199/)).toBeInTheDocument()
    expect(screen.getByText(/1393/)).toBeInTheDocument()
  })

  it('tel: 링크 attribute 정확', () => {
    render(<ContactsFooter />)
    const link0199 = screen.getByText(/1577-0199/).closest('a')
    const link1393 = screen.getByText(/1393/).closest('a')
    expect(link0199?.getAttribute('href')).toBe('tel:1577-0199')
    expect(link1393?.getAttribute('href')).toBe('tel:1393')
  })

  it('"도움이 필요하면" 권유 톤 카피 노출', () => {
    render(<ContactsFooter />)
    expect(screen.getByText(/도움이 필요하면/)).toBeInTheDocument()
  })
})
