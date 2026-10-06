'use client'

import { useEffect, useRef } from 'react'

interface Props {
  className?: string
}

const N = 8

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, mn: number, mx: number): number {
  return Math.max(mn, Math.min(mx, v))
}

export default function ReactiveOrb({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 부모 기준 마우스 좌표 (canvas 내부 좌표계와 일치)
    function initialMousePos() {
      const rect = canvas?.getBoundingClientRect()
      const w = rect?.width ?? window.innerWidth
      const h = rect?.height ?? window.innerHeight
      return { x: w * 0.72, y: h * 0.48 }
    }
    const mouse = initialMousePos()
    const smooth = { x: mouse.x, y: mouse.y }

    const blobAngles = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2)
    let blobOffsets = blobAngles.map(() => Math.random() * Math.PI * 2)
    const blobSpeeds = blobAngles.map(() => 0.003 + Math.random() * 0.002)

    function getBlobRadius(angle: number, t: number): number {
      let r = 1
      for (let i = 0; i < N; i++) {
        const diff = angle - blobAngles[i]
        r += 0.028 * Math.sin(diff * 2 + blobOffsets[i] + t * blobSpeeds[i] * 60)
      }
      return r
    }

    function resize() {
      if (!canvas) return
      // parent 크기 기준 (canvas internal pixel = parent display size)
      const parent = canvas.parentElement
      const rect = parent
        ? parent.getBoundingClientRect()
        : { width: window.innerWidth, height: window.innerHeight }
      canvas.width = rect.width
      canvas.height = rect.height
    }

    function handleMouse(e: MouseEvent) {
      // canvas 내부 좌표계로 변환 (parent 기준)
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }

    let visible = true
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting
      },
      { threshold: 0 },
    )
    observer.observe(canvas)

    resize()
    window.addEventListener('resize', resize)
    document.addEventListener('mousemove', handleMouse)

    function drawBlob(
      cx: number,
      cy: number,
      baseR: number,
      lx: number,
      ly: number,
      t: number,
    ) {
      if (!ctx) return

      // 배경 글로우
      const bgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.2)
      bgG.addColorStop(0, 'rgba(107,171,154,0.09)')
      bgG.addColorStop(0.4, 'rgba(80,140,120,0.04)')
      bgG.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(cx, cy, baseR * 2.2, 0, Math.PI * 2)
      ctx.fillStyle = bgG
      ctx.fill()

      // 블롭 경로
      const pts = 180
      const drawBlobPath = () => {
        ctx.beginPath()
        for (let i = 0; i <= pts; i++) {
          const angle = (i / pts) * Math.PI * 2
          const rMod = getBlobRadius(angle, t)
          const r = baseR * (0.97 + 0.03 * rMod)
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
      }

      drawBlobPath()

      // 빛 방향
      const lightX = cx + lx * baseR * 0.38
      const lightY = cy + ly * baseR * 0.38

      // 메인 구체 그라디언트
      const mainG = ctx.createRadialGradient(
        lightX - baseR * 0.15,
        lightY - baseR * 0.15,
        baseR * 0.04,
        cx + lx * baseR * 0.05,
        cy + ly * baseR * 0.05,
        baseR * 1.05,
      )
      mainG.addColorStop(0, `rgba(${180 + lx * 30},${220 + lx * 20},210,0.92)`)
      mainG.addColorStop(
        0.15,
        `rgba(${140 + lx * 20},${190 + lx * 10},175,0.85)`,
      )
      mainG.addColorStop(0.35, `rgba(${80 + lx * 15},${140 + lx * 8},128,0.78)`)
      mainG.addColorStop(0.6, 'rgba(30,58,52,0.88)')
      mainG.addColorStop(0.82, 'rgba(10,22,18,0.94)')
      mainG.addColorStop(1, 'rgba(4,8,6,0.98)')
      ctx.fillStyle = mainG
      ctx.fill()

      // 크로마틱 어버레이션
      ctx.save()
      ctx.translate(2, -1)
      drawBlobPath()
      const chromG = ctx.createRadialGradient(lightX, lightY, 0, cx, cy, baseR)
      chromG.addColorStop(0, 'rgba(107,200,160,0.06)')
      chromG.addColorStop(1, 'transparent')
      ctx.fillStyle = chromG
      ctx.fill()
      ctx.restore()

      // 스펙큘러 + 림 (블롭 클립 안)
      ctx.save()
      drawBlobPath()
      ctx.clip()

      const specX = cx + lx * baseR * 0.32 - baseR * 0.18
      const specY = cy + ly * baseR * 0.32 - baseR * 0.22
      const specG = ctx.createRadialGradient(
        specX,
        specY,
        0,
        specX,
        specY,
        baseR * 0.38,
      )
      specG.addColorStop(0, 'rgba(255,255,255,0.72)')
      specG.addColorStop(0.25, 'rgba(255,255,255,0.28)')
      specG.addColorStop(0.6, 'rgba(255,255,255,0.05)')
      specG.addColorStop(1, 'transparent')
      ctx.fillStyle = specG
      ctx.fill()

      const rimX = cx - lx * baseR * 0.62
      const rimY = cy - ly * baseR * 0.62
      const rimG = ctx.createRadialGradient(
        rimX,
        rimY,
        baseR * 0.6,
        rimX,
        rimY,
        baseR * 1.02,
      )
      rimG.addColorStop(0, 'transparent')
      rimG.addColorStop(0.7, 'rgba(107,171,154,0.08)')
      rimG.addColorStop(1, 'rgba(107,171,154,0.22)')
      ctx.fillStyle = rimG
      ctx.fill()
      ctx.restore()

      // 글리터
      for (let i = 0; i < 5; i++) {
        const ga = (i / 5) * Math.PI * 2 + t * 0.3 + lx
        const gr = baseR * (0.55 + 0.35 * Math.sin(ga * 1.7 + t))
        const gx = cx + gr * Math.cos(ga)
        const gy = cy + gr * Math.sin(ga)
        const size = 1.5 + Math.sin(t * 2 + i) * 0.8
        ctx.beginPath()
        ctx.arc(gx, gy, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.1 * Math.sin(t * 3 + i)})`
        ctx.fill()
      }
    }

    let raf = 0
    function render(ts: number) {
      const t = ts * 0.001
      smooth.x = lerp(smooth.x, mouse.x, 0.06)
      smooth.y = lerp(smooth.y, mouse.y, 0.06)

      if (canvas && visible) {
        const W = canvas.width
        const H = canvas.height
        if (ctx) ctx.clearRect(0, 0, W, H)

        const orbR = Math.min(W, H) * 0.32
        const orbX = W * 0.68 + Math.sin(t * 0.4) * orbR * 0.02
        const orbY = H * 0.5 + Math.cos(t * 0.3) * orbR * 0.015

        const dx = (smooth.x - orbX) / (W * 0.5)
        const dy = (smooth.y - orbY) / (H * 0.5)
        const dist = Math.sqrt(dx * dx + dy * dy)
        const lx = clamp(dx / (dist + 0.1), -1, 1)
        const ly = clamp(dy / (dist + 0.1), -1, 1)

        blobOffsets = blobOffsets.map((o, i) => o + blobSpeeds[i])

        drawBlob(orbX, orbY, orbR, lx, ly, t)
      }

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('mousemove', handleMouse)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'}
    />
  )
}
