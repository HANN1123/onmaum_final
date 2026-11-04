import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWebcam } from '@/features/ui/landing/hero-demo/useWebcam'

describe('공유 웹캠 요청의 화각 보존', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('6fd22ac와 같은 해상도·방향을 요청하고 해제할 때 스트림을 멈춘다', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    const video = { srcObject: null, play: vi.fn().mockResolvedValue(undefined) } as unknown as HTMLVideoElement
    const videoRef = { current: video }
    const { result, unmount } = renderHook(() => useWebcam(videoRef, true))

    await waitFor(() => expect(result.current).toBe('ready'))
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    expect(video.srcObject).toBe(stream)
    unmount()
    expect(stop).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
  })
})
