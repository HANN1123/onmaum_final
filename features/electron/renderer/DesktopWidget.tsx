'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import EmotionOrb from '@/features/ui/orb/EmotionOrb'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import type { WidgetView } from '@/features/electron/types/bridge'
import { widgetStatus, type WidgetStatus } from '@/features/electron/types/widgetStatus'
import { useDesktopBridge } from './desktopBridge'

const CALM_FALLBACK: EmotionResult = { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 }

export const WIDGET_STATUS_LABEL: Record<WidgetStatus, string> = {
  measuring: '측정 중',
  attention: '측정 확인 필요',
  stopped: '측정 꺼짐',
}

const DOT_CLASS: Record<WidgetStatus, string> = {
  measuring: 'bg-risk-good',
  attention: 'bg-risk-caution',
  stopped: 'bg-ink-400',
}

// Electron 전용 CSS 속성. drag 영역은 Windows에서 마우스 이벤트를 받지 않으므로 버튼은 no-drag에 둔다.
const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as CSSProperties

/** 메인 창이 최소화된 동안 측정 상태를 보여 주는 표시 전용 오브. 웹에서는 그리지 않는다. */
export default function DesktopWidget() {
  const bridge = useDesktopBridge()
  const [view, setView] = useState<WidgetView | null>(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!bridge) return
    let maxSeq = -1
    const accept = (v: WidgetView) => {
      // 구독 알림과 초기 조회가 엇갈려도 더 오래된 상태로 되돌아가지 않는다.
      if (v.seq < maxSeq) return
      maxSeq = v.seq
      setView(v)
      setNow(Date.now())
    }
    const off = bridge.onMeasurement(accept)
    bridge.getMeasurement().then(accept, (err: unknown) => {
      console.error('위젯 상태 조회 실패:', err)
    })
    return off
  }, [bridge])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!bridge) return null

  const status: WidgetStatus = view ? widgetStatus(view, now) : 'stopped'
  const snapshot = view?.snapshot ?? null

  return (
    <div className="flex h-screen w-screen select-none flex-col items-center justify-end gap-2 pb-2">
      <div
        style={DRAG}
        className={`flex cursor-grab items-center justify-center transition-opacity duration-500 ${
          status === 'stopped' ? 'opacity-45' : 'opacity-100'
        }`}
        title="끌어서 옮기기"
      >
        <EmotionOrb
          emotions={snapshot?.emotions ?? CALM_FALLBACK}
          recordCount={snapshot?.recordCount ?? 0}
          size={132}
          showCaption={false}
        />
      </div>
      <div
        style={NO_DRAG}
        className="flex items-center gap-2 rounded-full bg-white/90 py-1 pl-3 pr-1 text-xs text-ink-700 shadow-sm"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[status]}`} aria-hidden />
        <span role="status">{WIDGET_STATUS_LABEL[status]}</span>
        <button
          type="button"
          onClick={() => bridge.openMainWindow()}
          className="rounded-full bg-risk-good px-2.5 py-1 font-medium text-white transition-opacity hover:opacity-90"
        >
          열기
        </button>
      </div>
    </div>
  )
}
