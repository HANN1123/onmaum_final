'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EMOTION_LABELS, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { mmss, swatchColor } from './demoBits'
import styles from './measureDemo.module.css'
import { mixRgb, ORB_PALETTE, rgba } from './orbs/emotionPalette'
import type { TimelinePoint } from './sessionLog'

/** 차트를 읽는 이유. 'camera' 는 카메라가 가장 힘든 순간으로 다가간 동안이다. */
export type ScrubReason = 'pointer' | 'camera'

interface Props {
  points: TimelinePoint[]
  /** points 와 같은 길이의 매끈하게 다듬은 심박. 선과 읽어 주는 값이 같은 수를 쓴다. */
  smooth: number[]
  durationSec: number
  hardest: { start: number; end: number; emotion: Emotion } | null
  shares: Record<Emotion, number>
  scheme: 'dark' | 'light'
  /** 포인터 아래 표본 번호. 없으면 null */
  active: number | null
  onScrub: (index: number | null, reason?: ScrubReason) => void
}

const TOP = 34
const BOTTOM = 6
/** Stageshow 의 카메라: 한 번 다가가고(1.1초) 결과를 2.4초 보여준 뒤 빠진다. 곡선은 --ease-move(motion.css). */
const CAMERA_MS = 1100
const CAMERA_HOLD_MS = 2400
const CAMERA_START_MS = 2000
const CAMERA_MAX = 2.2
const CAMERA_PAD = 22

type CameraPhase = 'idle' | 'in' | 'out'

/**
 * 통화 한 건의 차트. Stageshow 의 원칙을 따른다.
 * - 선은 회색 하나. 불이 켜지는 건 가장 힘들었던 구간 하나뿐이다.
 * - 값은 말풍선으로 띄우지 않는다. 포인터를 따라 가는 세로선과 점만 그리고, 숫자는 위쪽 큰 숫자가 바꿔 읽는다.
 * - 감정은 선 아래 얇은 띠 하나로 한 번만 말하고, 범례가 이름과 비율을 붙인다.
 * - 처음 열릴 때 선이 왼쪽에서 그려지고, 힘든 구간이 켜진 뒤 카메라가 그 구간으로 한 번 다가갔다 빠진다.
 *   다가간 동안 위쪽 큰 숫자는 그 구간의 최고 심박을 읽는다. 차트에 포인터가 들어오면 카메라는 바로 빠진다.
 *   힘든 구간을 누르면 다시 볼 수 있다.
 */
export default function CallChart({ points, smooth, durationSec, hardest, shares, scheme, active, onScrub }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [phase, setPhase] = useState<CameraPhase>('idle')
  const timers = useRef<number[]>([])
  const scrubRef = useRef(onScrub)
  const light = scheme === 'light'

  useEffect(() => {
    scrubRef.current = onScrub
  }, [onScrub])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 힘든 구간의 최고점: 카메라가 다가가는 곳이자 그동안 읽어 줄 값
  const peak = useMemo(() => {
    if (!hardest) return null
    let best = -Infinity
    let index: number | null = null
    points.forEach((p, i) => {
      if (p.t >= hardest.start && p.t <= hardest.end && smooth[i] > best) {
        best = smooth[i]
        index = i
      }
    })
    return index
  }, [points, smooth, hardest])

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }

  /** delay 뒤 다가가고, 보여주고, 빠진다. */
  const runCamera = useCallback(
    (delay: number) => {
      clearTimers()
      if (peak === null) return
      const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
      at(delay, () => {
        setPhase('in')
        scrubRef.current(peak, 'camera')
      })
      at(delay + CAMERA_MS + CAMERA_HOLD_MS, () => {
        setPhase('out')
        scrubRef.current(null)
      })
      at(delay + CAMERA_MS * 2 + CAMERA_HOLD_MS, () => setPhase('idle'))
    },
    [peak],
  )

  // 열릴 때 한 번. 움직임 줄이기 설정이면 하지 않는다.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    runCamera(CAMERA_START_MS)
    return clearTimers
  }, [runCamera])

  /** 사람이 차트를 만지면 연출은 양보한다. */
  const yieldCamera = () => {
    if (phase !== 'in') return
    clearTimers()
    setPhase('out')
    scrubRef.current(null)
    timers.current.push(window.setTimeout(() => setPhase('idle'), CAMERA_MS))
  }

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
    let focus: { x: number; y: number; width: number; height: number } | null = null
    if (hardest) {
      const seg = points.map((p, i) => ({ p, i })).filter(({ p }) => p.t >= hardest.start && p.t <= hardest.end)
      hard = seg.map(({ p, i }, k) => `${k === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(smooth[i]).toFixed(1)}`).join('')
      const ys = seg.map(({ i }) => y(smooth[i]))
      const top = Math.min(...ys) - 24
      const bottom = Math.max(...ys) + 24
      focus = { x: x(hardest.start), y: top, width: x(hardest.end) - x(hardest.start), height: bottom - top }
    }
    return { w, h, x, y, line, area, hard, focus }
  }, [size, points, smooth, durationSec, hardest])

  // 카메라 변환: kit Camera 와 같은 식. 장면 가장자리 밖은 보이지 않게 묶는다.
  let scale = 1
  let tx = 0
  let ty = 0
  if (phase === 'in' && geo?.focus) {
    const { w, h, focus } = geo
    scale = Math.max(1, Math.min(CAMERA_MAX, w / (focus.width + CAMERA_PAD * 2), h / (focus.height + CAMERA_PAD * 2)))
    tx = Math.min(0, Math.max(w - w * scale, w / 2 - (focus.x + focus.width / 2) * scale))
    ty = Math.min(0, Math.max(h - h * scale, h / 2 - (focus.y + focus.height / 2) * scale))
  }
  const zoomed = phase === 'in'
  const busy = phase !== 'idle'

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
    if (!geo || busy) return
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
    onScrub(near, 'pointer')
  }

  const legend = (Object.keys(shares) as Emotion[])
    .filter((e) => shares[e] > 0)
    .sort((a, b) => shares[b] - shares[a])

  const ease = `${CAMERA_MS}ms var(--ease-move)`

  return (
    <div className={styles.callChart}>
      <div ref={boxRef} className={styles.callPlot} data-zoomed={zoomed ? '' : undefined}>
        {geo && (
          <svg
            width={geo.w}
            height={geo.h}
            className={styles.callSvg}
            onPointerEnter={yieldCamera}
            onPointerMove={onMove}
            onPointerLeave={() => {
              if (!busy) onScrub(null)
            }}
            aria-hidden="true"
          >
            <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: '0 0', transition: `transform ${ease}` }}>
              <path d={geo.area} className={styles.callArea} />
              {hardest && (
                <rect
                  x={geo.x(hardest.start)}
                  y={TOP - 10}
                  width={Math.max(2, geo.x(hardest.end) - geo.x(hardest.start))}
                  height={geo.h - TOP + 10 - BOTTOM}
                  fill={accent}
                  fillOpacity={light ? 0.09 : 0.14}
                  className={`${styles.callHard} ${styles.callHardBand}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!busy) runCamera(0)
                  }}
                />
              )}
              <path d={geo.line} pathLength={1} className={styles.callLine} vectorEffect="non-scaling-stroke" />
              {hardest && (
                <path
                  d={geo.hard}
                  className={`${styles.callHard} ${styles.callHardLine}`}
                  style={{ stroke: accent }}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {peak !== null && (
                <circle
                  cx={geo.x(points[peak].t)}
                  cy={geo.y(smooth[peak])}
                  r={4.5 / Math.max(scale, 1)}
                  className={styles.callPeak}
                  data-on={zoomed ? '' : undefined}
                  style={{ fill: accent }}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
            {hardest && (
              <text x={geo.x(hardest.start)} y={14} className={`${styles.callHard} ${styles.callNote}`} data-hide={busy ? '' : undefined}>
                가장 힘든 구간 · {mmss(hardest.start)}–{mmss(hardest.end)}
              </text>
            )}
            {!busy && active !== null && points[active] && (
              <g>
                <line x1={geo.x(points[active].t)} x2={geo.x(points[active].t)} y1={TOP - 10} y2={geo.h - BOTTOM} className={styles.callHair} />
                <circle cx={geo.x(points[active].t)} cy={geo.y(smooth[active])} r={4.5} className={styles.callDot} />
              </g>
            )}
          </svg>
        )}
      </div>
      <div className={styles.ribbon} data-dim={busy ? '' : undefined} aria-label="시간에 따른 감정">
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
