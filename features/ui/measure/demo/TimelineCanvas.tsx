'use client'

import { useEffect, useRef } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { mixRgb, ORB_PALETTE, rgba, type Rgb } from './orbs/emotionPalette'

export interface TimelinePoint {
  /** 통화 시작부터 지난 초 */
  t: number
  bpm: number
  emotion: Emotion
}

interface Props {
  /** t 오름차순 표본. 1초 간격이면 충분하다. */
  points: TimelinePoint[]
  durationSec: number
  /** 강조할 구간(초). 띠에서 이 구간만 진하게 찍고 양끝에 선을 긋는다. */
  highlight?: { start: number; end: number } | null
  scheme: 'dark' | 'light'
  className?: string
}

const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]
/** 감정이 바뀌기 전 이 시간 동안 두 색을 섞어 띠가 뚝 끊기지 않게 한다. */
const BLEND_SEC = 3

/**
 * 통화 한 건의 타임라인. 가로가 시간이다.
 * 띠의 색은 그 순간의 감정색(오브와 같은 팔레트), 위를 지나는 선은 심박이다.
 */
export default function TimelineCanvas({ points, durationSec, highlight = null, scheme, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length === 0 || durationSec <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const light = scheme === 'light'
    const paper = light ? WHITE : BLACK
    const ink = light ? 'rgba(0, 0, 0, 0.82)' : 'rgba(255, 255, 255, 0.88)'

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      let minBpm = Infinity
      let maxBpm = -Infinity
      for (const p of points) {
        if (p.bpm < minBpm) minBpm = p.bpm
        if (p.bpm > maxBpm) maxBpm = p.bpm
      }
      const span = Math.max(1, maxBpm - minBpm)
      const toX = (t: number) => (t / durationSec) * width
      const toY = (bpm: number) => height * 0.84 - ((bpm - minBpm) / span) * height * 0.6

      // 감정색 띠: 1px 세로 줄을 차례로 찍는다. 강조 구간은 진하게, 나머지는 연하게.
      for (let x = 0; x < width; x += 1) {
        const t = (x / width) * durationSec
        const color = colorAt(points, t)
        const inHighlight = highlight !== null && t >= highlight.start && t <= highlight.end
        const strength = inHighlight ? (light ? 0.6 : 0.7) : light ? 0.28 : 0.36
        ctx.fillStyle = rgba(mixRgb(paper, color, strength), 1)
        ctx.fillRect(x, 0, 1, height)
      }
      if (highlight) {
        ctx.fillStyle = ink
        ctx.fillRect(Math.round(toX(highlight.start)), 0, 1, height)
        ctx.fillRect(Math.round(toX(highlight.end)) - 1, 0, 1, height)
      }

      // 심박 선
      ctx.strokeStyle = ink
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      points.forEach((p, i) => {
        const x = toX(p.t)
        const y = toY(p.bpm)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    draw()
    return () => observer.disconnect()
  }, [points, durationSec, highlight, scheme])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

/** t 초 시점의 감정색. 다음 표본의 감정이 다르면 경계 앞 BLEND_SEC 동안 두 색을 섞는다. */
function colorAt(points: TimelinePoint[], t: number): Rgb {
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  const cur = points[lo]
  const base = ORB_PALETTE[cur.emotion].base
  // 같은 감정이 이어지는 동안은 섞을 필요가 없다. 바뀌는 지점을 앞으로 찾는다.
  let next = lo + 1
  while (next < points.length && points[next].emotion === cur.emotion) {
    if (points[next].t - t > BLEND_SEC) return base
    next += 1
  }
  if (next >= points.length) return base
  const gap = points[next].t - t
  if (gap >= BLEND_SEC) return base
  return mixRgb(base, ORB_PALETTE[points[next].emotion].base, 1 - gap / BLEND_SEC)
}
