import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ServiceWorkerRegistrar from '@/features/ui/common/ServiceWorkerRegistrar'
import DesktopWidget from '@/features/electron/renderer/DesktopWidget'
import DesktopWidgetSettings from '@/features/electron/renderer/DesktopWidgetSettings'
import {
  HEARTBEAT_MS,
  useDesktopMeasurementPublisher,
} from '@/features/electron/renderer/useDesktopMeasurementPublisher'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import type { DesktopEmotion, MeasurementSnapshot, WidgetView } from '@/features/electron/types/bridge'
import { createFakeBridge, uninstallBridge } from './fakeBridge'

afterEach(() => {
  cleanup()
  uninstallBridge()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const CALM: EmotionResult = { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 }

describe('DesktopEmotion', () => {
  it('EmotionResult와 같은 모양이다', () => {
    const a: DesktopEmotion = CALM
    const b: EmotionResult = a
    expect(b).toBe(CALM)
  })
})

describe('ServiceWorkerRegistrar', () => {
  let register: ReturnType<typeof vi.fn>
  beforeEach(() => {
    register = vi.fn(() => Promise.resolve({ scope: '/' }))
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true })
  })
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('웹에서는 지금처럼 /sw.js를 등록한다', () => {
    render(<ServiceWorkerRegistrar />)
    expect(register).toHaveBeenCalledWith('/sw.js')
  })

  it('Electron에서는 등록하지 않는다', () => {
    createFakeBridge().install()
    render(<ServiceWorkerRegistrar />)
    expect(register).not.toHaveBeenCalled()
  })
})

describe('useDesktopMeasurementPublisher', () => {
  type Props = Parameters<typeof useDesktopMeasurementPublisher>[0]
  const base: Props = { active: false, emotions: null, recordCount: 2, videoEl: null, saveFailed: false }

  it('웹에서는 아무것도 하지 않는다', () => {
    const { unmount } = renderHook((p: Props) => useDesktopMeasurementPublisher(p), { initialProps: base })
    unmount()
    expect(window.onmaumDesktop).toBeUndefined()
  })

  it('상태가 바뀔 때 스냅샷을 보내고, 화면을 떠나면 측정 끝남을 보낸다', () => {
    const fake = createFakeBridge()
    fake.install()
    const { rerender, unmount } = renderHook((p: Props) => useDesktopMeasurementPublisher(p), {
      initialProps: base,
    })
    const calls = () => fake.bridge.publishMeasurement.mock.calls.map((c) => c[0] as MeasurementSnapshot)
    expect(calls().at(-1)).toMatchObject({ active: false, recordCount: 2, videoFps: null })

    rerender({ ...base, active: true, emotions: CALM })
    expect(calls().at(-1)).toMatchObject({ active: true, emotions: CALM })

    unmount()
    expect(calls().at(-1)).toMatchObject({ active: false, emotions: null, videoFps: null })
  })

  it('측정 중에는 1초마다 프레임 증가량과 함께 heartbeat를 보낸다', () => {
    vi.useFakeTimers()
    const fake = createFakeBridge()
    fake.install()
    let frames = 100
    const video = { getVideoPlaybackQuality: () => ({ totalVideoFrames: frames }) } as unknown as HTMLVideoElement

    renderHook((p: Props) => useDesktopMeasurementPublisher(p), {
      initialProps: { ...base, active: true, emotions: CALM, videoEl: video },
    })
    const before = fake.bridge.publishMeasurement.mock.calls.length

    frames = 130
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_MS)
    })
    const last = fake.bridge.publishMeasurement.mock.calls.at(-1)?.[0] as MeasurementSnapshot
    expect(fake.bridge.publishMeasurement.mock.calls.length).toBe(before + 1)
    expect(last.videoFps).toBe(30)

    // 프레임이 멈추면 0
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_MS)
    })
    expect((fake.bridge.publishMeasurement.mock.calls.at(-1)?.[0] as MeasurementSnapshot).videoFps).toBe(0)
  })

  it('프레임 수를 알 수 없으면 videoFps는 null이다', () => {
    vi.useFakeTimers()
    const fake = createFakeBridge()
    fake.install()
    renderHook((p: Props) => useDesktopMeasurementPublisher(p), {
      initialProps: { ...base, active: true, videoEl: {} as HTMLVideoElement },
    })
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_MS)
    })
    expect((fake.bridge.publishMeasurement.mock.calls.at(-1)?.[0] as MeasurementSnapshot).videoFps).toBeNull()
  })
})

describe('DesktopWidgetSettings', () => {
  it('웹에서는 그리지 않는다', () => {
    const { container } = render(<DesktopWidgetSettings />)
    expect(container).toBeEmptyDOMElement()
  })

  it('Electron에서 현재 설정을 보여 주고 토글하면 bridge로 저장한다', async () => {
    const fake = createFakeBridge()
    fake.install()
    render(<DesktopWidgetSettings />)
    const sw = await screen.findByRole('switch', { name: '최소화 위젯' })
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'))

    fireEvent.click(sw)
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'))
    expect(fake.bridge.setWidgetEnabled).toHaveBeenCalledWith(false)
  })
})

describe('DesktopWidget', () => {
  const view = (o: Partial<WidgetView>, snap: Partial<MeasurementSnapshot> | null = {}): WidgetView => ({
    seq: 1,
    receivedAt: Date.now(),
    noFramesSince: null,
    noEmotionSince: null,
    endedWhileMinimized: false,
    snapshot:
      snap === null
        ? null
        : { active: true, emotions: CALM, recordCount: 3, videoFps: 30, saveFailed: false, sentAt: Date.now(), ...snap },
    ...o,
  })

  it('웹에서는 그리지 않는다', () => {
    const { container } = render(<DesktopWidget />)
    expect(container).toBeEmptyDOMElement()
  })

  it('상태 문구 3종을 보여 준다', async () => {
    const fake = createFakeBridge(view({ seq: 1 }))
    fake.install()
    render(<DesktopWidget />)
    expect(await screen.findByText('측정 중')).toBeInTheDocument()

    act(() => fake.emit(view({ seq: 2, noFramesSince: Date.now() - 10_000 }, { videoFps: 0 })))
    expect(await screen.findByText('측정 확인 필요')).toBeInTheDocument()

    act(() => fake.emit(view({ seq: 3, endedWhileMinimized: true }, { active: false })))
    expect(await screen.findByText('측정 꺼짐')).toBeInTheDocument()
  })

  it('더 오래된 순번은 버린다', async () => {
    const fake = createFakeBridge(view({ seq: 1 }))
    fake.install()
    render(<DesktopWidget />)
    await screen.findByText('측정 중')
    act(() => fake.emit(view({ seq: 5 }, { active: false })))
    await screen.findByText('측정 꺼짐')
    act(() => fake.emit(view({ seq: 4 })))
    expect(screen.getByText('측정 꺼짐')).toBeInTheDocument()
  })

  it('"열기"를 누르면 메인 창을 연다', async () => {
    const fake = createFakeBridge(view({}))
    fake.install()
    render(<DesktopWidget />)
    fireEvent.click(await screen.findByRole('button', { name: '열기' }))
    expect(fake.bridge.openMainWindow).toHaveBeenCalledTimes(1)
  })
})
