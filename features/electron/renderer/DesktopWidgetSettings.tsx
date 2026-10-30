'use client'

import { useEffect, useState } from 'react'
import { useDesktopBridge } from './desktopBridge'

/** 데스크톱 앱 전용 "최소화 위젯" 켜기/끄기. 웹에서는 그리지 않는다. */
export default function DesktopWidgetSettings() {
  const bridge = useDesktopBridge()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!bridge) return
    let cancelled = false
    bridge.getDesktopSettings().then(
      (s) => {
        if (!cancelled) setEnabled(s.widget.enabled)
      },
      () => {
        if (!cancelled) setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [bridge])

  if (!bridge) return null

  const toggle = () => {
    if (enabled === null) return
    bridge.setWidgetEnabled(!enabled).then(
      (s) => {
        setEnabled(s.widget.enabled)
        setFailed(false)
      },
      () => setFailed(true),
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">🫧 최소화 위젯</p>
          <p className="mt-1 text-xs text-ink-500">
            측정 중에 창을 내리면 화면 구석에 오브를 띄워 측정이 이어지고 있음을 알려드려요
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          aria-label="최소화 위젯"
          disabled={enabled === null}
          onClick={toggle}
          className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors disabled:opacity-40 ${
            enabled ? 'justify-end bg-risk-good' : 'justify-start bg-ink-300'
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
        </button>
      </div>
      {failed && <p className="text-xs text-risk-warning">설정을 불러오거나 저장하지 못했어요</p>}
    </div>
  )
}
