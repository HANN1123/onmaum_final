import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import CameraView from '@/features/camera/components/CameraView'

function fakeStream() {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  return { stream, track }
}

describe('CameraView 카메라 정리', () => {
  const originalMediaDevices = navigator.mediaDevices
  const originalSrcObject = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')
  let getUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    // happy-dom은 가짜 MediaStream을 srcObject로 받지 않으므로 값만 보관한다
    const store = new WeakMap<HTMLMediaElement, unknown>()
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get(this: HTMLMediaElement) {
        return store.get(this) ?? null
      },
      set(this: HTMLMediaElement, v: unknown) {
        store.set(this, v)
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: originalMediaDevices, configurable: true })
    if (originalSrcObject) Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', originalSrcObject)
    vi.restoreAllMocks()
  })

  it('세로로 돌리면 세로 틀에 맞추고, 돌린 뒤 거울처럼 뒤집는다', () => {
    const { container } = render(<CameraView active={false} rotation={90} />)
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video.style.transform).toBe('translate(-50%, -50%) scaleX(-1) rotate(90deg)')
    expect(video.style.width).toBe('133.3333%')
    // 전역 max-width: 100%에 잘리면 세로 틀을 채우지 못한다
    expect(video.className).toContain('max-w-none')
    expect(container.firstElementChild?.className).toContain('aspect-[3/4]')
  })

  it('회전이 없으면 기존 가로 틀을 유지한다', () => {
    const { container } = render(<CameraView active={false} />)
    expect(container.firstElementChild?.className).toContain('aspect-video')
  })

  it('측정 중에 화면을 떠나면(unmount) 카메라 track을 끈다', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const onReady = vi.fn()
    const { unmount } = render(<CameraView active onReady={onReady} />)
    await waitFor(() => expect(onReady).toHaveBeenCalled())

    unmount()
    expect(track.stop).toHaveBeenCalled()
  })

  it('측정을 끄면 카메라 track을 끄고 video 연결을 푼다', async () => {
    const { stream, track } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    const onReady = vi.fn()
    const { rerender } = render(<CameraView active onReady={onReady} />)
    await waitFor(() => expect(onReady).toHaveBeenCalled())
    const video = onReady.mock.calls[0][0] as HTMLVideoElement

    rerender(<CameraView active={false} onReady={onReady} />)
    expect(track.stop).toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
  })

  it('카메라를 받기 전에 떠나면 나중에 받은 track을 바로 끈다', async () => {
    const { stream, track } = fakeStream()
    let resolve: (s: MediaStream) => void = () => {}
    getUserMedia.mockReturnValue(new Promise<MediaStream>((r) => (resolve = r)))
    const { unmount } = render(<CameraView active />)
    unmount()
    resolve(stream)
    await waitFor(() => expect(track.stop).toHaveBeenCalled())
  })
})
