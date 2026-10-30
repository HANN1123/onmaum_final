import { describe, expect, it, vi } from 'vitest'
import { drawRotatedFrame } from '@/features/camera/lib/rotateFrame'

function fakeCanvas() {
  const ctx = { translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn() }
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
  return { canvas, ctx }
}

const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement

describe('drawRotatedFrame', () => {
  it('90도면 가로세로를 바꾸고 프레임을 가운데 기준으로 돌린다', () => {
    const { canvas, ctx } = fakeCanvas()
    expect(drawRotatedFrame(video, 90, canvas)).toBe(true)
    expect([canvas.width, canvas.height]).toEqual([480, 640])
    expect(ctx.translate).toHaveBeenCalledWith(240, 320)
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2)
    expect(ctx.drawImage).toHaveBeenCalledWith(video, -320, -240, 640, 480)
  })

  it('180도면 크기를 유지한다', () => {
    const { canvas } = fakeCanvas()
    drawRotatedFrame(video, 180, canvas)
    expect([canvas.width, canvas.height]).toEqual([640, 480])
  })

  it('2D 컨텍스트가 없으면 false를 돌려준다', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
    expect(drawRotatedFrame(video, 90, canvas)).toBe(false)
  })
})
