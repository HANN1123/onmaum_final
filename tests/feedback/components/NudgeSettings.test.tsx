import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NudgeSettings from '@/features/feedback/components/NudgeSettings'
import { loadSettings } from '@/shared/storage/settings'

vi.mock('@/features/feedback/hooks/useNotificationPermission', () => ({
  useNotificationPermission: () => ({
    supported: true,
    permission: 'granted',
    request: vi.fn().mockResolvedValue('granted'),
  }),
}))

describe('NudgeSettings', () => {
  beforeEach(() => localStorage.clear())

  it('토글 켜면 settings.nudge.enabled=true 저장', () => {
    render(<NudgeSettings />)
    const toggle = screen.getByRole('switch', { name: /위험도/ })
    fireEvent.click(toggle)
    expect(loadSettings().nudge.enabled).toBe(true)
  })
})
