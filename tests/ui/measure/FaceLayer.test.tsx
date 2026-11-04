import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FaceLayer from '@/features/ui/measure/demo/FaceLayer'
import { coverLayout } from '@/features/ui/measure/demo/rotationLayout'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('얼굴 오버레이의 소수 content-box 크기', () => {
  it('첫 표시·칸 크기·영상 해상도 변경에서 영상과 같은 소수 좌표를 쓴다', () => {
    let width = 725.625
    let height = 408.15625
    let resized: () => void = () => {}
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resized = callback }
      observe() {}
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width, height }) as DOMRect)
    const video = document.createElement('video')
    Object.defineProperties(video, { videoWidth: { configurable: true, value: 1280 }, videoHeight: { configurable: true, value: 720 } })
    const box = { x: 0.2, y: 0.25, w: 0.3, h: 0.4 }
    const { container } = render(<FaceLayer box={box} videoRef={{ current: video }} />)
    const verify = () => {
      const style = (container.firstElementChild!.firstElementChild as HTMLElement).style
      const layout = coverLayout(width, height, video.videoWidth, video.videoHeight, 0)!
      expect(parseFloat(style.left)).toBeCloseTo(layout.offsetX + box.x * layout.dispW, 6)
      expect(parseFloat(style.top)).toBeCloseTo(layout.offsetY + box.y * layout.dispH, 6)
      expect(parseFloat(style.width)).toBeCloseTo(box.w * layout.dispW, 6)
      expect(parseFloat(style.height)).toBeCloseTo(box.h * layout.dispH, 6)
    }
    verify()
    width = 468.25
    height = 611.375
    act(() => resized())
    verify()
    Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 } })
    act(() => video.dispatchEvent(new Event('resize')))
    verify()
  })
})
