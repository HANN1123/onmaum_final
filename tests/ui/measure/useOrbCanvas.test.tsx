import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useOrbCanvas } from '@/features/ui/measure/demo/orbs/useOrbCanvas'

type Draw = (ctx: CanvasRenderingContext2D, size: number, dt: number, t: number) => void

function Probe({ size, draw }: { size: number; draw: Draw }) {
  const ref = useOrbCanvas(size, draw)
  return <canvas ref={ref} />
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('draw 가 바뀌어도 캔버스를 다시 잡지 않고 누적 시간을 이어 간다', () => {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(performance, 'now').mockReturnValue(0)
  const ctx = { setTransform: vi.fn(), clearRect: vi.fn() } as unknown as CanvasRenderingContext2D
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
  const step = (now: number) => frames.shift()!(now)

  const first = vi.fn<Draw>()
  const { rerender } = render(<Probe size={100} draw={first} />)
  step(50)
  step(100)
  expect(first).toHaveBeenLastCalledWith(ctx, 100, 0.05, expect.closeTo(0.1))

  // 심박·감정이 바뀌어 draw 가 새로 만들어진 경우: 같은 루프가 새 draw 를 부르고 t 는 0으로 돌아가지 않는다
  const second = vi.fn<Draw>()
  rerender(<Probe size={100} draw={second} />)
  step(150)
  expect(second).toHaveBeenLastCalledWith(ctx, 100, 0.05, expect.closeTo(0.15))
  expect(getContext).toHaveBeenCalledTimes(1)
  expect(frames).toHaveLength(1)
})
