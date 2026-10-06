import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NudgeSettings from '@/components/nudge/NudgeSettings'
import { loadSettings } from '@/lib/storage/settings'

vi.mock('@/hooks/nudge/useNotificationPermission', () => ({
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
