import { useEffect, useRef } from 'react'

/**
 * 정사각 캔버스를 dpr 에 맞게 준비하고 매 프레임 draw 를 부른다.
 * draw(ctx, size, dt, t): size 는 CSS 픽셀, dt 는 초, t 는 누적 초.
 *
 * draw 는 ref 로 최신 것을 읽는다. 심박·감정·박동 함수가 바뀔 때마다 draw 가 새로 만들어지는데,
 * 그때마다 캔버스를 다시 잡고 t 를 0으로 돌리면 오브 회전이 처음 각도로 튀고 지난 박동 파동이
 * 옛 시계 기준으로 남아 늦게 사라졌다. 캔버스와 시계는 크기가 바뀔 때만 새로 시작한다.
 */
export function useOrbCanvas(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number, dt: number, t: number) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)

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
    let t = 0
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      t += dt
      ctx.clearRect(0, 0, size, size)
      drawRef.current(ctx, size, dt, t)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [size])

  return canvasRef
}
