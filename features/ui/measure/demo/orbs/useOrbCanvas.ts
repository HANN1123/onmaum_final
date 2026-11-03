import { useEffect, useRef } from 'react'

/**
 * 정사각 캔버스를 dpr 에 맞게 준비하고 매 프레임 draw 를 부른다.
 * draw(ctx, size, dt, t): size 는 CSS 픽셀, dt 는 초, t 는 누적 초.
 */
export function useOrbCanvas(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number, dt: number, t: number) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let frame = 0
    let last = performance.now()
    let t = 0
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      t += dt
      ctx.clearRect(0, 0, size, size)
      draw(ctx, size, dt, t)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [size, draw])

  return canvasRef
}
