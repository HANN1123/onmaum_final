import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ReportDemo from '@/features/ui/measure/demo/ReportDemo'

vi.mock('@/features/ui/landing/hero-demo/fonts', () => ({ sora: { variable: '' }, jetbrainsMono: { variable: '' } }))
vi.mock('@/features/ui/measure/demo/orbs/DotOrb', () => ({ default: () => null }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear() })

it('리포트 화면에서 측정으로 가는 버튼은 아래 한 곳뿐이다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  render(<ReportDemo />)
  // 저장된 기록을 읽은 뒤에 아래 버튼 묶음이 나온다
  expect(await screen.findByRole('link', { name: '기록 보기' })).toBeVisible()
  expect(screen.getByRole('link', { name: '측정 시작' })).toHaveAttribute('href', '/demo/measure')
})
