'use client'

import { useEffect, useRef } from 'react'

interface Props {
  /** 매 프레임 호출해 현재 파형 값(0~1)을 얻는다. */
  getPulse: () => number
  color?: string
  lineWidth?: number
  /** 프레임당 흐르는 픽셀 수 */
  speed?: number
  className?: string
}

/** 오른쪽에서 왼쪽으로 흐르는 맥박 파형. 선 하나, 색 하나. */
export default function PulseCanvas({ getPulse, color = '#ffffff', lineWidth = 1.5, speed = 2, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let samples: number[] = []
    let frame = 0

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const capacity = Math.ceil(width / speed) + 2
      samples = samples.slice(-capacity)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const draw = () => {
      const capacity = Math.ceil(width / speed) + 2
      samples.push(getPulse())
      if (samples.length > capacity) samples.splice(0, samples.length - capacity)

      ctx.clearRect(0, 0, width, height)
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const pad = height * 0.12
      const span = height - pad * 2
      const offset = width - samples.length * speed
      samples.forEach((v, i) => {
        const x = offset + i * speed
        const y = height - pad - v * span
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [getPulse, color, lineWidth, speed])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
