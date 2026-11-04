import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMeRppg } from '@/features/rppg/engine/useMeRppg'
import { getBlazeFace } from '@/features/rppg/engine/blazeFace'

vi.mock('@/features/rppg/engine/blazeFace', () => ({ getBlazeFace: vi.fn() }))

class FakeWorker {
  static latest: FakeWorker
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { FakeWorker.latest = this }
}

const detect = vi.fn(() => ({ detections: [{ boundingBox: { originX: 10, originY: 10, width: 80, height: 80 }, categories: [{ score: 1 }] }] }))
let frame: VideoFrameRequestCallback

function mount() {
  const video = {
    readyState: 2, videoWidth: 640, videoHeight: 480,
    requestVideoFrameCallback: vi.fn((cb: VideoFrameRequestCallback) => { frame = cb; return 1 }),
    cancelVideoFrameCallback: vi.fn(),
  } as unknown as HTMLVideoElement
  const videoRef = { current: video }
  return renderHook(() => useMeRppg(videoRef, true))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('Worker', FakeWorker)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(36 * 36 * 4) }) }) as never)
  vi.mocked(getBlazeFace).mockResolvedValue({ detectForVideo: detect } as unknown as Awaited<ReturnType<typeof getBlazeFace>>)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('엔진 실패 시 감정 분석 얼굴 입력 해제', () => {
  it.each(['model', 'worker'] as const)('%s 오류 뒤 얼굴은 inactive, 심박은 error를 유지하고 늦은 응답을 무시한다', async (kind) => {
    const { result } = mount()
    await act(async () => {})
    const worker = FakeWorker.latest
    act(() => {
      worker.onmessage?.({ data: { type: 'ready' } })
      frame(1000, {} as VideoFrameCallbackMetadata)
    })
    expect(result.current.getFace().status).toBe('face')
    act(() => {
      if (kind === 'model') worker.onmessage?.({ data: { type: 'error', message: '초기화 실패' } })
      else worker.onerror?.({ message: '워커 실패' })
    })
    expect(result.current.getFace()).toEqual({ status: 'inactive' })
    expect(result.current.reading.status).toBe('error')
    act(() => {
      worker.onmessage?.({ data: { type: 'ready' } })
      frame(2000, {} as VideoFrameCallbackMetadata)
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.getFace()).toEqual({ status: 'inactive' })
    expect(result.current.reading.status).toBe('error')
    expect(result.current.getFaceRate()).toBeNull()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('한 프레임의 일시적 예외는 엔진을 멈추지 않는다', async () => {
    const { result } = mount()
    await act(async () => {})
    const worker = FakeWorker.latest
    act(() => {
      worker.onmessage?.({ data: { type: 'ready' } })
      detect.mockImplementationOnce(() => {
        throw new Error('일시적 검출 오류')
      })
      frame(1000, {} as VideoFrameCallbackMetadata)
      frame(1033, {} as VideoFrameCallbackMetadata)
    })
    expect(result.current.getFace().status).toBe('face')
    expect(result.current.reading.status).not.toBe('error')
    expect(worker.terminate).not.toHaveBeenCalled()
  })

  it('BlazeFace 로드 실패 시 얼굴 공유를 해제한다', async () => {
    vi.mocked(getBlazeFace).mockRejectedValueOnce(new Error('얼굴 모델 실패'))
    const { result } = mount()
    await act(async () => {})
    expect(result.current.getFace()).toEqual({ status: 'inactive' })
    expect(result.current.reading.status).toBe('error')
  })

  it('워커 생성 자체가 실패해도 얼굴 공유를 해제한다', () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('생성 실패') } })
    const { result } = mount()
    expect(result.current.getFace()).toEqual({ status: 'inactive' })
    expect(result.current.reading.status).toBe('error')
  })
})
