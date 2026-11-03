'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { EMOTION_LABELS, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { mmss, swatchColor } from './demoBits'
import styles from './measureDemo.module.css'
import { mixRgb, ORB_PALETTE, rgba } from './orbs/emotionPalette'
import type { TimelinePoint } from './sessionLog'

interface Props {
  points: TimelinePoint[]
  /** points 와 같은 길이의 매끈하게 다듬은 심박. 선과 읽어 주는 값이 같은 수를 쓴다. */
  smooth: number[]
  durationSec: number
  hardest: { start: number; end: number; emotion: Emotion } | null
  shares: Record<Emotion, number>
  scheme: 'dark' | 'light'
  /** 손가락(포인터) 아래 표본 번호. 없으면 null */
  active: number | null
  onScrub: (index: number | null) => void
}

const TOP = 34
const BOTTOM = 6

/**
 * 통화 한 건의 차트. Stageshow 의 원칙을 따른다.
 * - 선은 회색 하나. 불이 켜지는 건 가장 힘들었던 구간 하나뿐이다.
 * - 값은 말풍선으로 띄우지 않는다. 포인터를 따라 가는 세로선과 점만 그리고, 숫자는 위쪽 큰 숫자가 바꿔 읽는다.
 * - 감정은 선 아래 얇은 띠 하나로 한 번만 말하고, 범례가 이름과 비율을 붙인다.
 * - 처음 열릴 때 선이 왼쪽에서 그려지고, 다 그려진 뒤 힘든 구간이 켜진다.
 */
export default function CallChart({ points, smooth, durationSec, hardest, shares, scheme, active, onScrub }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const light = scheme === 'light'

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const geo = useMemo(() => {
    const { w, h } = size
    if (w === 0 || h === 0 || points.length < 2) return null
    let lo = Infinity
    let hi = -Infinity
    for (const v of smooth) {
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    lo -= 6
    hi += 6
    const plotH = h - TOP - BOTTOM
    const x = (t: number) => (t / durationSec) * w
    const y = (b: number) => TOP + (1 - (b - lo) / (hi - lo)) * plotH
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(smooth[i]).toFixed(1)}`).join('')
    const area = `${line}L${w},${h - BOTTOM}L0,${h - BOTTOM}Z`
    let hard = ''
    if (hardest) {
      const seg = points
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.t >= hardest.start && p.t <= hardest.end)
      hard = seg.map(({ p, i }, k) => `${k === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(smooth[i]).toFixed(1)}`).join('')
    }
    return { w, h, x, y, line, area, hard }
  }, [size, points, smooth, durationSec, hardest])

  // 같은 감정이 이어지는 구간을 한 덩어리로
  const runs = useMemo(() => {
    const out: { emotion: Emotion; start: number; end: number }[] = []
    for (const p of points) {
      const last = out[out.length - 1]
      if (last && last.emotion === p.emotion) last.end = p.t
      else out.push({ emotion: p.emotion, start: p.t, end: p.t })
    }
    return out
  }, [points])

  const accent = hardest ? swatchColor(hardest.emotion, light) : 'transparent'
  const ribbon = (e: Emotion) => {
    const p = ORB_PALETTE[e]
    return light
      ? rgba(mixRgb([255, 255, 255], mixRgb(p.base, p.deep, 0.3), 0.62), 1)
      : rgba(mixRgb([0, 0, 0], p.base, 0.62), 1)
  }

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!geo) return
    const rect = event.currentTarget.getBoundingClientRect()
    const t = ((event.clientX - rect.left) / rect.width) * durationSec
    // 1초 간격 표본이므로 가장 가까운 표본을 이분 탐색으로 찾는다.
    let lo = 0
    let hi = points.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (points[mid].t < t) lo = mid + 1
      else hi = mid
    }
    const near = lo > 0 && Math.abs(points[lo - 1].t - t) < Math.abs(points[lo].t - t) ? lo - 1 : lo
    onScrub(near)
  }

  const legend = (Object.keys(shares) as Emotion[])
    .filter((e) => shares[e] > 0)
    .sort((a, b) => shares[b] - shares[a])

  return (
    <div className={styles.callChart}>
      <div ref={boxRef} className={styles.callPlot}>
        {geo && (
          <svg
            width={geo.w}
            height={geo.h}
            className={styles.callSvg}
            onPointerMove={onMove}
            onPointerLeave={() => onScrub(null)}
            aria-hidden="true"
          >
            <path d={geo.area} className={styles.callArea} />
            {hardest && (
              <g className={styles.callHard}>
                <rect
                  x={geo.x(hardest.start)}
                  y={TOP - 10}
                  width={Math.max(2, geo.x(hardest.end) - geo.x(hardest.start))}
                  height={geo.h - TOP + 10 - BOTTOM}
                  fill={accent}
                  opacity={light ? 0.09 : 0.14}
                />
                <text x={geo.x(hardest.start)} y={14} className={styles.callNote}>
                  가장 힘든 구간 · {mmss(hardest.start)}–{mmss(hardest.end)}
                </text>
              </g>
            )}
            <path d={geo.line} pathLength={1} className={styles.callLine} />
            {hardest && <path d={geo.hard} className={`${styles.callHard} ${styles.callHardLine}`} style={{ stroke: accent }} />}
            {active !== null && points[active] && (
              <g>
                <line x1={geo.x(points[active].t)} x2={geo.x(points[active].t)} y1={TOP - 10} y2={geo.h - BOTTOM} className={styles.callHair} />
                <circle cx={geo.x(points[active].t)} cy={geo.y(smooth[active])} r={4.5} className={styles.callDot} />
              </g>
            )}
          </svg>
        )}
      </div>
      <div className={styles.ribbon} aria-label="시간에 따른 감정">
        {runs.map((r, i) => (
          <span key={`${r.start}-${i}`} style={{ flexGrow: r.end - r.start + 1, background: ribbon(r.emotion) }} />
        ))}
      </div>
      <div className={styles.chartFoot}>
        <span>00:00</span>
        <span className={styles.legend}>
          {legend.map((e) => (
            <span key={e}>
              <i style={{ background: swatchColor(e, light) }} aria-hidden="true" />
              {EMOTION_LABELS[e]} {Math.round(shares[e] * 100)}%
            </span>
          ))}
        </span>
        <span>{mmss(durationSec)}</span>
      </div>
    </div>
  )
}
