import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OFF_READING } from '@/features/rppg/engine/rppgGate'
import type { WatchSample } from '@/features/rppg/lib/heartRateSource'
import MeasureDemo from '@/features/ui/measure/demo/MeasureDemo'

const state = vi.hoisted(() => ({
  webcam: 'error', modelsReady: false, rppgBpm: null as number | null,
  latest: { t: 1000, bpm: 92, contact: 'good' } as WatchSample | null,
  status: 'connected' as 'connected' | 'idle', push: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('@/features/ui/landing/hero-demo/fonts', () => ({ sora: { variable: '' }, jetbrainsMono: { variable: '' } }))
vi.mock('@/features/ui/landing/hero-demo/useDemoTheme', () => ({ useDemoTheme: () => ['dark', vi.fn()] }))
vi.mock('@/features/ui/landing/hero-demo/useWebcam', () => ({ useWebcam: () => state.webcam }))
vi.mock('@/features/electron/renderer/useDesktopMeasurementPublisher', () => ({ useDesktopMeasurementPublisher: vi.fn() }))
vi.mock('@/features/rppg/hooks/useHeartRateDevice', () => ({ useHeartRateDevice: () => ({
  supported: true, status: state.status, latest: state.latest, failure: null, connect: vi.fn(), disconnect: vi.fn(),
}) }))
vi.mock('@/features/ui/measure/demo/heartRate', async (original) => ({
  ...await original<typeof import('@/features/ui/measure/demo/heartRate')>(),
  useHeartRateSource: () => ({ displayBpm: state.rppgBpm, quality: state.rppgBpm === null ? null : 'motion',
    reading: { ...OFF_READING, rawBpm: state.rppgBpm, quality: state.rppgBpm === null ? null : 'motion' },
    getPulse: () => 0, getFace: () => ({ status: 'inactive' }), getFaceRate: () => null }),
}))
vi.mock('@/features/ui/measure/demo/useFaceTrack', () => ({ useFaceTrack: () => ({ modelsReady: state.modelsReady, box: null, emotion: null }) }))
vi.mock('@/features/ui/measure/demo/useStoredOverview', () => ({ useStoredOverview: () => null }))
vi.mock('@/features/ui/measure/demo/useStoredSession', () => ({ useStoredSession: () => null }))
vi.mock('@/features/ui/measure/demo/FaceLayer', () => ({ default: () => null }))
vi.mock('@/features/ui/measure/demo/PulseCanvas', () => ({ default: () => null }))
vi.mock('@/features/ui/measure/demo/Morph', () => ({ Morph: ({ children, className }: { children: ReactNode; className?: string }) => <span className={className}>{children}</span> }))
vi.mock('@/features/ui/measure/demo/orbs/DotOrb', () => ({ default: ({ bpm, getPulse }: { bpm?: number; getPulse: () => number }) =>
  <button data-testid="orb" data-bpm={bpm} onClick={() => getPulse()}>오브</button> }))
vi.mock('skullet/react', () => ({
  SkulletProvider: ({ children }: { children: ReactNode }) => children,
  Skeleton: ({ children, loading }: { children: ReactNode; loading: boolean }) => loading ? <span>준비 뼈대</span> : children,
  SkeletonBox: () => null,
}))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear() })

it('카메라 오류·모델 로딩 중에도 워치 숫자와 오브가 보이며 종료 때 기록하고 표시를 멈춘다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'error'; state.modelsReady = false; state.rppgBpm = null
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  render(<MeasureDemo />)
  expect(screen.getByText('92')).toBeVisible()
  expect(screen.getByTestId('orb')).toHaveAttribute('data-bpm', '92')
  fireEvent.click(screen.getAllByRole('button', { name: '측정 종료' })[0])
  expect(screen.getByText('--')).toBeVisible()
  expect(screen.getByTestId('orb')).not.toHaveAttribute('data-bpm')
  const saved = JSON.parse(sessionStorage.getItem('onmaum_demo_session')!)
  expect(saved.samples[0]).toMatchObject({ bpm: 92, source: 'watch', rppgBpm: null })
  expect(state.push).toHaveBeenCalledWith('/demo/result')
})

it('측정 도중 워치가 끊기면 카메라 참고값을 표시하고 정상 알림 한 번으로 복귀한다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  const { rerender } = render(<MeasureDemo />)
  expect(screen.getByText('92')).toBeVisible()
  state.status = 'idle'; state.latest = null
  rerender(<MeasureDemo />)
  expect(screen.getByText('74')).toBeVisible()
  expect(screen.getByText('카메라 · 참고값')).toBeVisible()
  state.status = 'connected'; state.latest = { t: 1000, bpm: 95, contact: 'good' }
  rerender(<MeasureDemo />)
  expect(screen.getByText('95')).toBeVisible()
  expect(screen.queryByText('카메라 · 참고값')).toBeNull()
})
