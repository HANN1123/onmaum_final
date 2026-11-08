import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SurveyDemo from '@/features/ui/landing/hero-demo/SurveyDemo'
import { loadProfile } from '@/shared/storage/profile'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '@/shared/storage/settings'
import { loadConsent } from '@/shared/storage/consent'

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }))
vi.mock('@/features/ui/landing/hero-demo/fonts', () => ({ sora: { variable: '' }, jetbrainsMono: { variable: '' } }))
vi.mock('@/features/ui/landing/hero-demo/useDemoTheme', () => ({ useDemoTheme: () => ['dark', vi.fn()] }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  nav.push.mockReset()
  window.history.replaceState(null, '', '/')
})

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

describe('SurveyDemo: 처음 설문', () => {
  it('답을 고르고 건너뛴 뒤, 기록 저장을 골라야 끝나며 답·설정·동의를 저장한다', async () => {
    render(<SurveyDemo />)
    click(/커피/)
    click('다음')
    click(/어깨·목 풀기/)
    click(/지금은 어려워요/)
    // "해당 없음"을 고르면 다른 선택이 풀린다
    expect(screen.getByRole('button', { name: /어깨·목 풀기/ })).toHaveAttribute('aria-pressed', 'false')
    click(/어깨·목 풀기/)
    click('다음')
    click('건너뛰기') // 마음 돌보기는 답하지 않음
    click('건너뛰기') // 회복법도 답하지 않음
    click(/30초 미만/)
    click('다음')
    click(/숨 참기 없는 느린 호흡/)
    click('다음')
    click('남은 질문 건너뛰기')

    const finish = screen.getByRole('button', { name: '기록 저장 여부를 골라 주세요' })
    expect(finish).toBeDisabled()
    click(/저장할게요/)
    click(/화면 안에서만/)
    click('저장하고 측정 시작')

    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith('/demo/measure'))
    expect(loadProfile()).toEqual({ reliefs: [], treats: ['coffee'], deskActions: ['shoulders'], breakBudget: 'under30s', breathing: 'slow1' })
    expect(loadConsent()?.record).toBe(true)
    expect(loadSettings().nudge).toMatchObject({ enabled: true, osNotify: false })
    // 체크인 문항에 답하지 않았으므로 기존 설정 유지
    expect(loadSettings().checkinSlots).toEqual({ morning: true, afternoon: true })
    expect(localStorage.getItem('onmaum_onboarded')).toBe('true')
    expect(localStorage.getItem('onmaum_survey_version')).toBe('2')
  })

  it('기록 화면에서 고치러 오면 저장된 답을 미리 고르고, 마치면 기록 화면으로 돌아간다', async () => {
    localStorage.setItem('onmaum_profile', JSON.stringify({ reliefs: [], treats: ['water'], tone: 'plain' }))
    localStorage.setItem('onmaum_consent', JSON.stringify({ version: 1, record: false, decidedAt: 'x' }))
    saveSettings({ ...DEFAULT_SETTINGS, checkinSlots: { morning: false, afternoon: true } })
    window.history.replaceState(null, '', '/demo/survey?edit=1')
    render(<SurveyDemo />)
    expect(await screen.findByRole('button', { name: /시원한 물/ })).toHaveAttribute('aria-pressed', 'true')
    click('남은 질문 건너뛰기')
    expect(screen.getByRole('button', { name: /저장하지 않을게요/ })).toHaveAttribute('aria-pressed', 'true')
    click('고친 내용 저장')
    await vi.waitFor(() => expect(nav.push).toHaveBeenCalledWith('/demo/records'))
    expect(loadProfile()?.tone).toBe('plain')
    expect(loadSettings().checkinSlots).toEqual({ morning: false, afternoon: true })
  })
})
