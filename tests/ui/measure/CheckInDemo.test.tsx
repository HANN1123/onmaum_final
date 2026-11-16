import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CheckinSlot } from '@/features/feedback/lib/checkin'

// 상태 확인 조건은 useCheckin 이 정한다. 여기서는 그 결과(due·slot)만 바꿔 화면 전환을 본다
const view = { due: true, slot: 'morning' as CheckinSlot | null, line: '최근 30분은 평소와 비슷했어요', submit: vi.fn() }
vi.mock('@/features/feedback/hooks/useCheckin', () => ({ useCheckin: () => view }))

import CheckInDemo from '@/features/ui/measure/demo/CheckInDemo'

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 10, 17, 10, 0) })
  Object.assign(view, { due: true, slot: 'morning', submit: vi.fn() })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('응답하면 감사 문구를 보이고, 같은 시간대에는 다시 묻지 않는다', () => {
  render(<CheckInDemo />)
  fireEvent.click(screen.getByRole('button', { name: '맞아요' }))
  expect(view.submit).toHaveBeenCalledWith('agree')
  // 응답 뒤 useCheckin 은 같은 시간대를 더 묻지 않는다
  Object.assign(view, { due: false, slot: 'morning' })
  act(() => { vi.advanceTimersByTime(60_000) })
  expect(screen.getByRole('status').textContent).toContain('오전 상태 확인')
})

it('화면을 켜 둔 채 오후 질문이 오면 오전 감사 문구를 거두고 오후 질문을 보인다', () => {
  render(<CheckInDemo />)
  fireEvent.click(screen.getByRole('button', { name: '맞아요' }))
  Object.assign(view, { due: true, slot: 'afternoon' })
  act(() => { vi.advanceTimersByTime(60_000) })
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('region', { name: '오후 상태 확인' })).toBeTruthy()
})

it('날짜가 바뀌면 어제의 감사 문구를 보이지 않는다', () => {
  render(<CheckInDemo />)
  fireEvent.click(screen.getByRole('button', { name: '맞아요' }))
  Object.assign(view, { due: false, slot: null })
  act(() => { vi.advanceTimersByTime(24 * 60 * 60_000) })
  expect(screen.queryByRole('status')).toBeNull()
})
