import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PulseCanvas from '@/features/ui/measure/demo/PulseCanvas'

// 캔버스에 그린 점 개수로 파형에 쌓인 표본 수를 읽는다(moveTo 1 + lineTo n-1)
let frames: FrameRequestCallback[] = []
let points = 0
const ctx = {
  setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), stroke: vi.fn(),
  moveTo: vi.fn(() => { points = 1 }), lineTo: vi.fn(() => { points += 1 }),
  strokeStyle: '', lineWidth: 0, lineJoin: '',
}

function runFrames(n: number) {
  for (let i = 0; i < n; i++) {
    const pending = frames
    frames = []
    pending.forEach((cb) => cb(0))
  }
}

beforeEach(() => {
  frames = []; points = 0
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => { frames = [] })
  // getContext 는 오버로드라 mockReturnValue 의 타입이 WebGL 쪽으로 잡힌다. 구현 함수로 2D 목을 돌려준다
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as unknown as HTMLCanvasElement['getContext'])
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(50)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('getPulse 함수나 색이 바뀌어도 그려 둔 파형을 버리지 않고 이어 그린다', () => {
  const { rerender } = render(<PulseCanvas getPulse={() => 0.2} color="#fff" />)
  runFrames(10)
  expect(points).toBe(10)
  rerender(<PulseCanvas getPulse={() => 0.8} color="#c8f26b" />)
  runFrames(5)
  expect(points).toBe(15)
  // 새 함수의 값으로 이어 그린다
  expect(ctx.strokeStyle).toBe('#c8f26b')
})
