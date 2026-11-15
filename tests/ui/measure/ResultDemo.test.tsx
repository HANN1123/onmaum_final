import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ResultDemo from '@/features/ui/measure/demo/ResultDemo'

vi.mock('@/features/ui/landing/hero-demo/fonts', () => ({ sora: { variable: '' }, jetbrainsMono: { variable: '' } }))
vi.mock('@/features/ui/measure/demo/orbs/DotOrb', () => ({ default: () => null }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear() })

it('끝낸 측정이 없으면 측정으로 가는 버튼은 아래 한 곳뿐이다', () => {
  render(<ResultDemo />)
  expect(screen.getByRole('link', { name: '측정 시작' })).toHaveAttribute('href', '/demo/measure')
})

it('끝낸 측정이 있으면 다시 측정 버튼은 아래 한 곳뿐이고, 심박 출처에서 워치 부분만 워치 색으로 표시한다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  sessionStorage.setItem('onmaum_demo_session', JSON.stringify({
    startedAt: 0, endedAt: 4000, durationSec: 4,
    samples: [
      { t: 0, bpm: 80, source: 'watch', emotion: 'calm' },
      { t: 1, bpm: 82, source: 'watch', emotion: 'calm' },
      { t: 2, bpm: 84, source: 'watch', emotion: 'calm' },
      { t: 3, bpm: 76, source: 'rppg', emotion: 'calm' },
    ],
  }))
  render(<ResultDemo />)
  expect(await screen.findByText('측정 평균 심박')).toBeVisible()
  expect(screen.getByRole('link', { name: '다시 측정' })).toHaveAttribute('href', '/demo/measure')
  const watch = screen.getByText('워치 75%')
  expect(watch.className).toContain('watchInk')
  expect(watch.parentElement).toHaveTextContent('워치 75% · 카메라 25%')
})
