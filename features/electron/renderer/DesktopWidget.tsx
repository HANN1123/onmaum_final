'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getDominantEmotion, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { WidgetView } from '@/features/electron/types/bridge'
import { widgetStatus, type WidgetStatus } from '@/features/electron/types/widgetStatus'
import DotOrb from '@/features/ui/measure/demo/orbs/DotOrb'
import { useDesktopBridge } from './desktopBridge'

export const WIDGET_STATUS_LABEL: Record<WidgetStatus, string> = {
  measuring: '측정 중',
  attention: '측정 확인 필요',
  stopped: '측정 꺼짐',
}

/** 상태 점 색. 측정 화면과 같은 단색 톤에 상태만 색으로 구분한다 */
const DOT_COLOR: Record<WidgetStatus, string> = {
  measuring: '#4fd1c5',
  attention: '#f5c04a',
  stopped: 'rgba(255, 255, 255, 0.4)',
}

/** 위젯 오브의 박동. 위젯 계약에는 심박이 없으므로 일정한 느린 호흡처럼 움직인다(실제 심박이 아니다) */
function breathe(): number {
  const phase = (performance.now() / 4000) % 1
  return 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI)
}

// Electron 전용 CSS 속성. drag 영역은 Windows에서 마우스 이벤트를 받지 않으므로 버튼은 no-drag에 둔다.
const DRAG = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as CSSProperties

/**
 * 메인 창이 최소화된 동안 측정 상태를 보여 주는 표시 전용 오브. 웹에서는 그리지 않는다.
 * 새 디자인의 점 오브(DotOrb)를 쓰고, 측정 화면이 보낸 감정 비율에서 우세 감정의 색을 따른다.
 * 색은 오브가 천천히(약 3초) 바뀌므로 1초마다 오는 상태로도 깜빡이지 않는다.
 */
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
  const emotions = view?.snapshot?.emotions ?? null
  const emotion: Emotion = emotions ? getDominantEmotion(emotions) : 'calm'

  return (
    <div
      style={{ display: 'flex', height: '100vh', width: '100vw', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingBottom: 8, userSelect: 'none' }}
    >
      <div
        style={{ ...DRAG, cursor: 'grab', opacity: status === 'stopped' ? 0.45 : 1, transition: 'opacity 0.5s ease' }}
        title="끌어서 옮기기"
      >
        <DotOrb getPulse={breathe} emotion={emotion} scheme="dark" size={132} />
      </div>
      <div
        style={{
          ...NO_DRAG,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 4px 4px 12px',
          background: 'rgba(0, 0, 0, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: 12,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: DOT_COLOR[status], flexShrink: 0 }} aria-hidden />
        <span role="status">{WIDGET_STATUS_LABEL[status]}</span>
        <button
          type="button"
          onClick={() => bridge.openMainWindow()}
          style={{ border: '1px solid rgba(255, 255, 255, 0.26)', background: 'transparent', color: '#fff', padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}
        >
          열기
        </button>
      </div>
    </div>
  )
}
