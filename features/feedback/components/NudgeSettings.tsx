'use client'

import { useEffect, useState } from 'react'
import { useNotificationPermission } from '@/features/feedback/hooks/useNotificationPermission'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '@/shared/storage/settings'

export default function NudgeSettings() {
  const { supported, permission, request } = useNotificationPermission()
  // localStorage는 클라이언트에서만 — 첫 렌더는 기본값으로 SSR과 일치시키고, mount 후 실제 설정 로드 (hydration mismatch 방지)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings())
  }, [])

  const update = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }

  const toggle = async () => {
    const enabling = !settings.nudge.enabled
    if (enabling && supported && permission === 'default') await request()
    update({ ...settings, nudge: { ...settings.nudge, enabled: enabling } })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">🌿 위험도 알림</p>
          <p className="mt-1 text-xs text-ink-500">
            마음에 힘이 오래 들어가 있으면 살며시 쉬어가자고 알려드려요
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.nudge.enabled}
          aria-label="위험도 알림"
          onClick={toggle}
          className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors ${
            settings.nudge.enabled ? 'justify-end bg-risk-good' : 'justify-start bg-ink-300'
          }`}
        >
          {/* knob을 flex 자식으로 — absolute+translate 의존 제거(항상 보임). 위치는 justify로. */}
          <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
        </button>
      </div>

      {settings.nudge.enabled && (
        <label className="flex items-center justify-between text-xs text-ink-600">
          하루 최대 알림
          <select
            value={settings.nudge.maxPerDay}
            onChange={(e) =>
              update({
                ...settings,
                nudge: { ...settings.nudge, maxPerDay: Number(e.target.value) },
              })
            }
            className="rounded-lg border border-ink-300 px-2 py-1"
          >
            <option value={1}>1회</option>
            <option value={2}>2회</option>
            <option value={3}>3회</option>
          </select>
        </label>
      )}

      {supported && permission === 'denied' && (
        <p className="text-xs text-ink-400">브라우저 알림이 차단돼 앱 안에서만 알려드려요</p>
      )}
    </div>
  )
}
