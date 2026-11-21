import { useEffect, useRef } from 'react'

/**
 * 정사각 캔버스를 dpr 에 맞게 준비하고 매 프레임 draw 를 부른다.
 * draw(ctx, size, dt, t): size 는 CSS 픽셀, dt 는 초, t 는 누적 초.
 *
 * draw 가 바뀌어도(심박수·색·박동 함수가 바뀔 때마다 새로 만들어진다) 그리기 루프와 누적 시간 t 는 이어 간다.
 * 예전에는 draw 가 바뀔 때마다 루프를 새로 시작해 t 가 0으로 돌아가고 캔버스가 지워져서,
 * 워치 심박이 1초마다 바뀌면 오브 회전이 처음 자리로 튀고 박동 띠가 끊겼다(2026-11-20).
 * 루프는 크기가 바뀔 때만 새로 시작하고, 매 프레임 가장 최근 draw 를 부른다.
 */
export function useOrbCanvas(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number, dt: number, t: number) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  // 누적 시간은 크기가 바뀌어 루프를 새로 시작해도 이어 간다
  const timeRef = useRef(0)

  useEffect(() => {
    drawRef.current = draw
  }, [draw])

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
    const loop = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      timeRef.current += dt
      ctx.clearRect(0, 0, size, size)
      drawRef.current(ctx, size, dt, timeRef.current)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [size])

  return canvasRef
}
