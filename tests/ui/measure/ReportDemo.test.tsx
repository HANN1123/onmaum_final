import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ReportDemo from '@/features/ui/measure/demo/ReportDemo'

const state = vi.hoisted(() => ({ loading: false }))
vi.mock('@/features/ui/landing/hero-demo/fonts', () => ({ sora: { variable: '' }, jetbrainsMono: { variable: '' } }))
vi.mock('@/features/ui/measure/demo/orbs/DotOrb', () => ({ default: () => null }))
// 저장된 기록을 아직 읽지 못한 상태(null)를 만들 수 있게 한다. 그 밖에는 실제 훅을 그대로 쓴다
vi.mock('@/features/ui/measure/demo/useStoredOverview', async (original) => {
  const real = await original<typeof import('@/features/ui/measure/demo/useStoredOverview')>()
  return { ...real, useStoredOverview: () => (state.loading ? null : real.useStoredOverview()) }
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); state.loading = false })

it('리포트 화면에서 측정으로 가는 버튼은 아래 한 곳뿐이다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  render(<ReportDemo />)
  // 저장된 기록을 읽은 뒤에 나오는 왼쪽 차트 제목을 기다린다
  expect(await screen.findByText('오늘 스트레스')).toBeVisible()
  expect(screen.getByRole('link', { name: '측정 시작' })).toHaveAttribute('href', '/demo/measure')
})

it('저장된 기록을 읽는 동안에도 측정으로 가는 버튼이 보인다', () => {
  state.loading = true
  render(<ReportDemo />)
  expect(screen.getByText('기록을 읽는 중입니다')).toBeVisible()
  expect(screen.getByRole('link', { name: '측정 시작' })).toHaveAttribute('href', '/demo/measure')
})
