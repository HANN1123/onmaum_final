import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTypewriter } from '@/features/ui/landing/hero-demo/useTypewriter'

describe('useTypewriter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('startDelay 뒤 speed 간격으로 한 글자씩 드러내고, 다 치면 done 이 된다', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useTypewriter('온마음', 10, 100))

    expect(result.current.displayed).toBe('')
    expect(result.current.done).toBe(false)

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.displayed).toBe('')

    act(() => {
      vi.advanceTimersByTime(10)
    })
    expect(result.current.displayed).toBe('온')

    act(() => {
      vi.advanceTimersByTime(20)
    })
    expect(result.current.displayed).toBe('온마음')
    expect(result.current.done).toBe(true)
  })

  it('text 가 바뀌면 처음부터 다시 친다', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ text }) => useTypewriter(text, 10, 0), {
      initialProps: { text: '가나' },
    })
    act(() => {
      vi.advanceTimersByTime(20)
    })
    expect(result.current.displayed).toBe('가나')

    rerender({ text: '다라마' })
    expect(result.current.displayed).toBe('')
    act(() => {
      vi.advanceTimersByTime(30)
    })
    expect(result.current.displayed).toBe('다라마')
  })
})
