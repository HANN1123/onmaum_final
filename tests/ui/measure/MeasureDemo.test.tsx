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
  nudgeOpen: false, nudgeClose: vi.fn(), onSample: [] as unknown[],
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
vi.mock('@/features/ui/measure/demo/useFaceTrack', () => ({ useFaceTrack: (_v: unknown, _e: unknown, opts?: { onSample?: unknown }) => {
  state.onSample.push(opts?.onSample)
  return { modelsReady: state.modelsReady, box: null, emotion: null }
} }))
vi.mock('@/features/feedback/hooks/useNudge', () => ({ useNudge: () => ({
  bannerOpen: state.nudgeOpen, message: '최근 몇 분 동안 평소보다 높은 상태가 이어졌어요. 잠깐 쉬어 갈까요?', close: state.nudgeClose, muteToday: vi.fn(),
}) }))
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
  state.push.mockReset(); state.stop.mockReset(); state.nudgeOpen = false; state.onSample = []; state.stop.mockImplementation(async () => null); state.recordingEnabled = []
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

it('워치가 대표 심박이면 카메라 파형 칸은 그대로 두고 워치 리듬 칸을 따로 보이며, 워치가 끊기면 그 칸이 사라진다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  const { rerender } = render(<MeasureDemo />)
  // 두 칸의 이름표에 각자의 심박을 적어 그래프 옆에서 두 값을 읽는다
  expect(screen.getByText('맥박 파형 · rPPG 대기 · 참고값 · 74 BPM')).toBeVisible()
  expect(screen.getByText('심박 리듬 · 워치 BPM 기준 · 92 BPM')).toBeVisible()
  state.status = 'idle'; state.latest = null
  rerender(<MeasureDemo />)
  expect(screen.getByText('맥박 파형 · rPPG 대기 · 참고값')).toBeVisible()
  expect(screen.queryByText(/심박 리듬/)).toBeNull()
})

it('워치가 연결된 동안에는 표본이 접촉 불량이거나 늦어도 워치 리듬 칸을 떼지 않고 수신 대기로 표시한다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  const { rerender } = render(<MeasureDemo />)
  expect(screen.getByText('심박 리듬 · 워치 BPM 기준 · 92 BPM')).toBeVisible()
  // 접촉 불량 표본 한 번: 대표 심박은 카메라로 넘어가지만 워치 칸은 남는다
  state.latest = { t: 1000, bpm: 92, contact: 'poor' }
  rerender(<MeasureDemo />)
  expect(screen.getByText('74')).toBeVisible()
  expect(screen.getByText('심박 리듬 · 워치 BPM 기준 · 수신 대기')).toBeVisible()
  // 8초 넘게 새 표본이 없을 때도 같다
  state.latest = { t: 1000, bpm: 92, contact: 'good' }
  now.mockReturnValue(20_000)
  rerender(<MeasureDemo />)
  expect(screen.getByText('심박 리듬 · 워치 BPM 기준 · 수신 대기')).toBeVisible()
  // 정상 표본이 오면 같은 칸에서 바로 이어진다
  state.latest = { t: 20_000, bpm: 95, contact: 'good' }
  rerender(<MeasureDemo />)
  expect(screen.getByText('심박 리듬 · 워치 BPM 기준 · 95 BPM')).toBeVisible()
})

it('측정을 끝내는 버튼은 하나뿐이고, 끝낸 뒤에는 같은 버튼으로 다시 잰다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  render(<MeasureDemo />)
  fireEvent.click(screen.getByRole('button', { name: '측정 종료' }))
  expect(await screen.findByText('--')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '측정 시작' }))
  expect(await screen.findByText('92')).toBeVisible()
  expect(screen.getByRole('button', { name: '측정 종료' })).toBeVisible()
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

it('휴식 알림이 뜨면 쉬어 가기 제안을 보이고, 호흡을 따라 하는 동안은 감정 기록 표본을 넘기지 않는다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  localStorage.setItem('onmaum_consent', JSON.stringify({ version: 1, record: true, decidedAt: '2026-11-09T00:00:00.000Z' }))
  localStorage.setItem('onmaum_profile', JSON.stringify({ reliefs: [], deskActions: [], breathing: 'sigh1', breakBudget: 'about1m' }))
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74; state.status = 'idle'; state.latest = null
  state.nudgeOpen = true
  render(<MeasureDemo />)
  expect(screen.getByText(/평소보다 높은 상태가 이어졌어요/)).toBeVisible()
  expect(state.onSample.at(-1)).toBeTypeOf('function')
  // 자리에서 할 것을 고르지 않았으니 중립 제안 → 다른 제안으로 호흡
  fireEvent.click(await screen.findByRole('button', { name: '다른 제안' }))
  const follow = screen.queryByRole('button', { name: '따라 하기' }) ?? (fireEvent.click(screen.getByRole('button', { name: '다른 제안' })), screen.getByRole('button', { name: '따라 하기' }))
  fireEvent.click(follow)
  expect(state.nudgeClose).toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: '순환 한숨 호흡' })).toBeVisible()
  expect(state.onSample.at(-1)).toBeUndefined()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  expect(state.onSample.at(-1)).toBeTypeOf('function')
})
