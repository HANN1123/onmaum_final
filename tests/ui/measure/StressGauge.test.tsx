import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import StressGauge, { StressBar } from '@/features/ui/measure/demo/StressGauge'

it('오늘 값과 단계를 ▲ 와 함께 보이고, 오늘 단계의 칸만 켠다', () => {
  const { container } = render(<StressGauge value={41.6} level="high" baseline={{ mode: 'absolute', baselineN: null }} />)
  expect(screen.getByRole('img', { name: '오늘 스트레스 42, 높음' })).toBeTruthy()
  expect(screen.getByText('스트레스 상태 (오늘)')).toBeTruthy()
  expect(container.querySelector('[data-side]')?.textContent).toBe('▲42')
  const on = container.querySelectorAll('[data-on="true"]')
  expect(Array.from(on, (el) => el.textContent)).toEqual(['높음', ''])
})

it('저장된 오늘 기록이 없으면 ▲ 없이 알려 준다', () => {
  render(<StressGauge value={null} level={null} baseline={{ mode: 'absolute', baselineN: null }} />)
  expect(screen.getByRole('img', { name: '오늘 스트레스 저장된 기록 없음' })).toBeTruthy()
  expect(screen.queryByText(/▲/)).toBeNull()
})

it('측정 화면 세로 게이지는 점수 없이 ▶ 로 위치만 보이고, 위에서부터 매우 높음 → 낮음 순서다', () => {
  const { container } = render(<StressBar value={20} level="typical" baseline={null} />)
  expect(screen.getByRole('img', { name: '지금 스트레스 보통' })).toBeTruthy()
  const names = Array.from(container.querySelectorAll('[data-on]'), (el) => el.textContent).filter(Boolean)
  expect(names).toEqual(['매우 높음', '높음', '보통', '낮음'])
  const mark = container.querySelector<HTMLElement>('[data-mark]')
  expect(mark?.textContent).toBe('▶')
  // 절대 기준 보통 칸(15~30)의 20 은 아래에서 두 번째 칸(25%~50%) 안
  const bottom = parseFloat(mark!.style.bottom)
  expect(bottom).toBeGreaterThan(25)
  expect(bottom).toBeLessThan(50)
  expect(container.textContent).not.toMatch(/\d/)
})

it('측정 전에는 ▶ 를 보이지 않는다', () => {
  const { container } = render(<StressBar value={null} level={null} baseline={null} />)
  expect(screen.getByRole('img', { name: '지금 스트레스 측정 전' })).toBeTruthy()
  expect(container.querySelector('[data-mark]')).toBeNull()
})
