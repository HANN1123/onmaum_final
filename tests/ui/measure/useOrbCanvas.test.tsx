import { act, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useOrbCanvas } from '@/features/ui/measure/demo/orbs/useOrbCanvas'

type Draw = (ctx: CanvasRenderingContext2D, size: number, dt: number, t: number) => void

function Orb({ draw }: { draw: Draw }) {
  const ref = useOrbCanvas(100, draw)
  return <canvas ref={ref} />
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('draw 가 바뀌어도 그리기 루프를 새로 시작하지 않고 누적 시간을 이어 간다', () => {
  const ctx = { setTransform: vi.fn(), clearRect: vi.fn() } as unknown as CanvasRenderingContext2D
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const queue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  /** 16ms 뒤 프레임 하나를 돌린다 */
  const tick = () => act(() => {
    now += 16
    queue.shift()?.(now)
  })

  const times: number[] = []
  const first: Draw = (_c, _s, _dt, t) => times.push(t)
  const { rerender } = render(<Orb draw={first} />)
  for (let i = 0; i < 10; i++) tick()
  // 심박·색이 바뀌면 오브는 새 draw 를 만든다
  const second: Draw = (_c, _s, _dt, t) => times.push(t)
  rerender(<Orb draw={second} />)
  tick()
  tick()

  // 캔버스를 다시 준비하지 않았고(지워지지 않음), 시간이 0으로 돌아가지 않았다
  expect(getContext).toHaveBeenCalledTimes(1)
  for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1])
  expect(times.at(-1)).toBeCloseTo(0.192, 3)
})
