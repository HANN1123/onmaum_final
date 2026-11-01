'use client'

import { useCallback, useRef } from 'react'
import { useOrbCanvas } from './useOrbCanvas'

interface Props {
  getPulse: () => number
  size?: number
  className?: string
}

interface Ring {
  born: number
}

const RING_LIFE = 1.4

/**
 * 심박 파문. 박동마다 가운데에서 1px 고리가 하나 퍼져 나가며 사라진다.
 * 가운데 원은 박동에 맞춰 조금 부푼다. 흰색 하나.
 */
export default function RippleOrb({ getPulse, size = 280, className }: Props) {
  const ringsRef = useRef<Ring[]>([])
  const prevRef = useRef(0)
  const smoothRef = useRef(0)

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, s: number, _dt: number, t: number) => {
      const v = getPulse()
      // 파형이 0.5 를 위로 지날 때를 박동으로 본다.
      if (prevRef.current < 0.5 && v >= 0.5) ringsRef.current.push({ born: t })
      prevRef.current = v
      smoothRef.current += (v - smoothRef.current) * 0.3
      const p = smoothRef.current

      const c = s / 2
      const R = c * 0.92
      const core = R * 0.2

      ringsRef.current = ringsRef.current.filter((ring) => t - ring.born < RING_LIFE)
      for (const ring of ringsRef.current) {
        const age = (t - ring.born) / RING_LIFE
        const eased = 1 - (1 - age) * (1 - age)
        const radius = core + (R - core) * eased
        ctx.beginPath()
        ctx.arc(c, c, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - age) * 0.8})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(c, c, core * (1 + p * 0.35), 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.75 + p * 0.25})`
      ctx.fill()
    },
    [getPulse],
  )

  const ref = useOrbCanvas(size, draw)
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />
}
