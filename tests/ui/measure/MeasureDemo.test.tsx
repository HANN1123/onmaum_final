import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OFF_READING } from '@/features/rppg/engine/rppgGate'
import type { WatchSample } from '@/features/rppg/lib/heartRateSource'
import MeasureDemo from '@/features/ui/measure/demo/MeasureDemo'

const state = vi.hoisted(() => ({
  webcam: 'error', modelsReady: false, rppgBpm: null as number | null,
  latest: { t: 1000, bpm: 92, contact: 'good' } as WatchSample | null,
  status: 'connected' as 'connected' | 'idle', push: vi.fn(),
  recordingEnabled: [] as boolean[],
  stop: vi.fn(async () => null as unknown),
}))
vi.mock('@/features/ui/measure/demo/useMeasureRecording', () => ({ useMeasureRecording: (enabled: boolean) => {
  state.recordingEnabled.push(enabled)
  return { push: vi.fn(), stop: state.stop, status: null }
} }))
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
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear()
  state.push.mockReset(); state.stop.mockReset(); state.stop.mockImplementation(async () => null); state.recordingEnabled = []
})

it('카메라 오류·모델 로딩 중에도 워치 숫자와 오브가 보이며 종료 때 기록하고 표시를 멈춘다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'error'; state.modelsReady = false; state.rppgBpm = null
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  render(<MeasureDemo />)
  expect(screen.getByText('92')).toBeVisible()
  expect(screen.getByTestId('orb')).toHaveAttribute('data-bpm', '92')
  fireEvent.click(screen.getAllByRole('button', { name: '측정 종료' })[0])
  expect(await screen.findByText('--')).toBeVisible()
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

it('저장 여부를 아직 고르지 않았으면 한 번 묻고, 고른 값을 기억해 저장을 켠다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74; state.status = 'idle'; state.latest = null
  render(<MeasureDemo />)
  expect(await screen.findByRole('region', { name: '기록 저장 여부' })).toBeVisible()
  expect(state.recordingEnabled.at(-1)).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.queryByRole('region', { name: '기록 저장 여부' })).toBeNull()
  expect(JSON.parse(localStorage.getItem('onmaum_consent')!).record).toBe(true)
  expect(state.recordingEnabled.at(-1)).toBe(true)
})

it('측정 종료는 남은 기록 저장이 끝난 뒤 결과 화면으로 간다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  localStorage.setItem('onmaum_consent', JSON.stringify({ version: 1, record: true, decidedAt: '2026-11-09T00:00:00.000Z' }))
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74; state.status = 'idle'; state.latest = null
  let release: (v: unknown) => void = () => {}
  state.stop.mockImplementation(() => new Promise((r) => { release = r }))
  render(<MeasureDemo />)
  await waitFor(() => expect(state.recordingEnabled.at(-1)).toBe(true))
  fireEvent.click(screen.getAllByRole('button', { name: '측정 종료' })[0])
  expect(state.stop).toHaveBeenCalledTimes(1)
  expect(state.push).not.toHaveBeenCalled()
  await act(async () => { release({ saved: 1, failed: false, sessionId: 's1' }) })
  expect(state.push).toHaveBeenCalledWith('/demo/result')
})
