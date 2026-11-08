import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BreathingGuide from '@/features/ui/measure/demo/BreathingGuide'
import CareCard from '@/features/ui/measure/demo/CareCard'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear() })

describe('BreathingGuide: 호흡 안내 창', () => {
  it('준비 화면에서 주의 문구를 보이고, 시작하면 숨 안내 문구가 바뀌며 끝나면 평소 호흡으로 돌아가라고 한다', () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const onClose = vi.fn()
    render(<BreathingGuide plan={{ technique: 'sigh', durationSec: 60 }} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: '순환 한숨 호흡' })).toBeVisible()
    expect(screen.getByText(/어지럽거나/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /시작/ }))
    expect(screen.getByText('코로 천천히 들이마셔요')).toBeVisible()
    const step = (t: number) => act(() => { now = t; frames.shift()?.(t) })
    step(2500)
    expect(screen.getByText('편하다면, 짧게 한 번 더 들이마셔요')).toBeVisible()
    step(4000)
    expect(screen.getByText('입으로 길고 부드럽게 내쉬어요')).toBeVisible()
    step(64_000)
    expect(screen.getByText('이제 평소처럼 편하게 숨 쉬세요.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(onClose).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('Esc 로 닫는다', () => {
    const onClose = vi.fn()
    render(<BreathingGuide plan={{ technique: 'slow', durationSec: 60 }} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('CareCard: 쉬어 가기 제안', () => {
  it('고른 답을 돌려 보이고, 호흡 제안이면 따라 하기로 연다', async () => {
    localStorage.setItem('onmaum_profile', JSON.stringify({ reliefs: [], deskActions: ['water'], breakBudget: 'about1m', breathing: 'sigh1', tone: 'plain' }))
    const onBreathe = vi.fn()
    render(<CareCard moment="during" onBreathe={onBreathe} />)
    const texts = new Set<string>()
    for (let i = 0; i < 2; i += 1) {
      texts.add((await screen.findByText(/물 한 모금|순환 한숨 호흡 1분/)).textContent!)
      fireEvent.click(screen.getByRole('button', { name: '다른 제안' }))
    }
    expect(texts).toEqual(new Set(['물 한 모금', '순환 한숨 호흡 1분']))
    if (!screen.queryByRole('button', { name: '따라 하기' })) fireEvent.click(screen.getByRole('button', { name: '다른 제안' }))
    fireEvent.click(screen.getByRole('button', { name: '따라 하기' }))
    expect(onBreathe).toHaveBeenCalledWith({ technique: 'sigh', durationSec: 60 })
  })

  it('설문 답이 없으면 중립 제안과 설문으로 가는 길을 보인다', async () => {
    render(<CareCard moment="day" onBreathe={vi.fn()} />)
    expect(await screen.findByRole('link', { name: '설문으로 맞추기' })).toHaveAttribute('href', '/demo/survey')
  })
})
