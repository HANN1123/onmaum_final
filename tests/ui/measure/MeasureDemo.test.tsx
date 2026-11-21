import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OFF_READING } from '@/features/rppg/engine/rppgGate'
import type { WatchSample } from '@/features/rppg/lib/heartRateSource'
import MeasureDemo from '@/features/ui/measure/demo/MeasureDemo'

const state = vi.hoisted(() => ({
  webcam: 'error', modelsReady: false, rppgBpm: null as number | null,
  latest: { t: 1000, bpm: 92, contact: 'good' } as WatchSample | null,
  status: 'connected' as 'connected' | 'idle', push: vi.fn(), prefetch: vi.fn(),
  recordingEnabled: [] as boolean[],
  nudgeOpen: false, nudgeClose: vi.fn(), onSample: [] as unknown[],
  stop: vi.fn(async () => null as unknown),
  box: null as { x: number; y: number; width: number; height: number } | null,
  faceEmotion: null as 'angry' | null,
}))
vi.mock('@/features/ui/measure/demo/useMeasureRecording', () => ({ useMeasureRecording: (enabled: boolean) => {
  state.recordingEnabled.push(enabled)
  return { push: vi.fn(), stop: state.stop, status: null }
} }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push, prefetch: state.prefetch }) }))
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
  return { modelsReady: state.modelsReady, box: state.box, emotion: state.faceEmotion, emotionLabel: state.faceEmotion ? '화남' : null }
} }))
vi.mock('@/features/feedback/hooks/useNudge', () => ({ useNudge: () => ({
  bannerOpen: state.nudgeOpen, message: '최근 몇 분 동안 평소보다 높은 상태가 이어졌어요. 잠깐 쉬어 갈까요?', close: state.nudgeClose, muteToday: vi.fn(),
}) }))
vi.mock('@/features/ui/measure/demo/useStoredOverview', () => ({ useStoredOverview: () => null }))
vi.mock('@/features/ui/measure/demo/useStoredSession', () => ({ useStoredSession: () => null }))
vi.mock('@/features/ui/measure/demo/FaceLayer', () => ({ default: () => null }))
vi.mock('@/features/ui/measure/demo/PulseCanvas', () => ({ default: () => null }))
vi.mock('@/features/ui/measure/demo/Morph', () => ({ Morph: ({ children, className }: { children: ReactNode; className?: string }) => <span className={className}>{children}</span> }))
vi.mock('@/features/ui/measure/demo/orbs/DotOrb', () => ({ default: ({ bpm, getPulse, palette }: { bpm?: number; getPulse: () => number; palette?: { base: number[] } }) =>
  <button data-testid="orb" data-bpm={bpm} data-palette={palette?.base.join(',')} onClick={() => getPulse()}>오브</button> }))
vi.mock('skullet/react', () => ({
  SkulletProvider: ({ children }: { children: ReactNode }) => children,
  Skeleton: ({ children, loading }: { children: ReactNode; loading: boolean }) => loading ? <span>준비 뼈대</span> : children,
  SkeletonBox: () => null,
}))
const WATCH = '스마트워치 (심박, bpm)'
const RPPG = 'rPPG (심박, bpm)'
/** 파형 칸 이름표("이름: 값") 요소. 값은 안쪽 요소라 이름 글자로 찾고 전체 글을 비교한다 */
const waveTag = (label: string) => screen.getByText(label + ':')
/** 오른쪽 큰 심박 숫자. 워치 칸 이름표에도 같은 숫자가 있어 글자로 찾지 않고 칸으로 찾는다 */
const bigBpm = () => document.querySelector('[class*="_bpm_"]') as HTMLElement

afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear()
  state.push.mockReset(); state.prefetch.mockReset(); state.stop.mockReset(); state.nudgeOpen = false; state.onSample = []; state.stop.mockImplementation(async () => null); state.recordingEnabled = []; state.box = null; state.faceEmotion = null
})

it('위쪽은 심박 상태·감정 상태 두 칸과 스트레스 상태 오브로 나뉘고, 오브는 스트레스 단계 색과 단계 이름만 보인다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74; state.status = 'idle'; state.latest = null
  render(<MeasureDemo />)
  expect(screen.getByText('심박 상태')).toBeVisible()
  expect(screen.getByText('감정 상태')).toBeVisible()
  expect(screen.getByText('스트레스 상태')).toBeVisible()
  // 예전 "현재 감정·현재 상태" 칸과 점수 표시는 없앴다
  expect(screen.queryByText('현재 감정')).toBeNull()
  expect(screen.queryByText(/점수/)).toBeNull()
  // 표정 점수가 아직 없으면 단계 대신 수집 중이고, 오브는 낮음 색(평온 색)이다
  expect(screen.getByText('표정 수집 중')).toBeVisible()
  expect(screen.getByTestId('orb')).toHaveAttribute('data-palette', '79,209,197')
  fireEvent.click(screen.getByRole('button', { name: '측정 종료' }))
  await waitFor(() => expect(state.push).toHaveBeenCalledWith('/demo/result'))
})

it('모니터링 Info 에는 다섯 행만 남기고, 워치 연결 버튼은 심박 측정 방식 행에 둔다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  // 카메라가 실패해도 워치는 연결할 수 있어야 한다
  state.webcam = 'error'; state.modelsReady = false; state.rppgBpm = null; state.status = 'idle'; state.latest = null
  render(<MeasureDemo />)
  const info = screen.getByRole('region', { name: '모니터링 Info' })
  const keys = [...info.querySelectorAll('[class*="_k_"]')].map((el) => el.textContent)
  expect(keys).toEqual(['측정 시간', '심박 신호 품질', '얼굴 검출률', '심박 측정 방식', '기록 여부'])
  for (const gone of ['결합 근거', '오늘', '14일 기준선', '워치']) expect(screen.queryByText(gone)).toBeNull()
  expect(info).toContainElement(screen.getByRole('button', { name: '워치 연결' }))
})

it('얼굴 추적 표시는 카메라 칸 아래 배지로 보이고, 얼굴을 찾았을 때만 추적 중으로 켠다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  state.webcam = 'error'; state.modelsReady = true; state.rppgBpm = null; state.status = 'idle'; state.latest = null
  const { rerender } = render(<MeasureDemo />)
  const badge = () => screen.getAllByRole('status').find((el) => el.className.includes('faceBadge'))!
  expect(badge()).toHaveTextContent('카메라 대기')
  expect(badge()).not.toHaveAttribute('data-on')
  state.webcam = 'ready'
  rerender(<MeasureDemo />)
  expect(badge()).toHaveTextContent('얼굴 찾는 중')
  state.box = { x: 10, y: 10, width: 100, height: 100 }
  rerender(<MeasureDemo />)
  expect(badge()).toHaveTextContent('얼굴 추적 중')
  expect(badge()).toHaveAttribute('data-on')
  // 카메라 위쪽의 긴 이름표는 없앴다
  expect(screen.queryByText(/카메라 · /)).toBeNull()
})

it('카메라 오류·모델 로딩 중에도 워치 숫자와 오브가 보이며 종료 때 기록하고 결과 화면으로 간다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'error'; state.modelsReady = false; state.rppgBpm = null
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  render(<MeasureDemo />)
  expect(bigBpm()).toHaveTextContent(/^92$/)
  expect(screen.getByTestId('orb')).toHaveAttribute('data-bpm', '92')
  expect(state.prefetch).toHaveBeenCalledWith('/demo/result')
  fireEvent.click(screen.getAllByRole('button', { name: '측정 종료' })[0])
  await waitFor(() => expect(state.push).toHaveBeenCalledWith('/demo/result'))
  // 이동 전에 화면을 '측정 종료' 상태로 다시 그리지 않는다(끊겨 보이던 원인). 정리는 화면을 떠날 때 한다
  expect(screen.queryByText('--')).toBeNull()
  expect(screen.getByTestId('orb')).toHaveAttribute('data-bpm', '92')
  const saved = JSON.parse(sessionStorage.getItem('onmaum_demo_session')!)
  expect(saved.samples[0]).toMatchObject({ bpm: 92, source: 'watch', rppgBpm: null })
})

it('측정 도중 워치가 끊기면 카메라 심박을 참고값 표시 없이 보이고 정상 알림 한 번으로 복귀한다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  const { rerender } = render(<MeasureDemo />)
  expect(bigBpm()).toHaveTextContent(/^92$/)
  state.status = 'idle'; state.latest = null
  rerender(<MeasureDemo />)
  expect(bigBpm()).toHaveTextContent(/^74$/)
  expect(screen.getByText('rPPG')).toBeVisible()
  state.status = 'connected'; state.latest = { t: 1000, bpm: 95, contact: 'good' }
  rerender(<MeasureDemo />)
  expect(bigBpm()).toHaveTextContent(/^95$/)
  expect(screen.queryByText('rPPG')).toBeNull()
})

it('워치가 대표 심박이면 카메라 파형 칸은 그대로 두고 워치 리듬 칸을 따로 보이며, 워치가 끊기면 그 칸이 사라진다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  const { rerender } = render(<MeasureDemo />)
  // 두 칸의 이름표에 각자의 심박을 적어 그래프 옆에서 두 값을 읽는다
  expect(waveTag(RPPG)).toHaveTextContent(/^rPPG \(심박, bpm\): 74$/)
  expect(waveTag(WATCH)).toHaveTextContent('스마트워치 (심박, bpm): 92')
  state.status = 'idle'; state.latest = null
  rerender(<MeasureDemo />)
  expect(waveTag(RPPG)).toHaveTextContent(/^rPPG \(심박, bpm\): 74$/)
  expect(screen.queryByText(/스마트워치/)).toBeNull()
})

it('워치가 연결된 동안에는 표본이 접촉 불량이거나 늦어도 워치 리듬 칸을 떼지 않고 수신 대기로 표시한다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  const { rerender } = render(<MeasureDemo />)
  expect(waveTag(WATCH)).toHaveTextContent('스마트워치 (심박, bpm): 92')
  // 접촉 불량 표본 한 번: 대표 심박은 카메라로 넘어가지만 워치 칸은 남는다
  state.latest = { t: 1000, bpm: 92, contact: 'poor' }
  rerender(<MeasureDemo />)
  expect(bigBpm()).toHaveTextContent(/^74$/)
  expect(waveTag(WATCH)).toHaveTextContent('스마트워치 (심박, bpm): 수신 대기')
  // 8초 넘게 새 표본이 없을 때도 같다
  state.latest = { t: 1000, bpm: 92, contact: 'good' }
  now.mockReturnValue(20_000)
  rerender(<MeasureDemo />)
  expect(waveTag(WATCH)).toHaveTextContent('스마트워치 (심박, bpm): 수신 대기')
  // 정상 표본이 오면 같은 칸에서 바로 이어진다
  state.latest = { t: 20_000, bpm: 95, contact: 'good' }
  rerender(<MeasureDemo />)
  expect(waveTag(WATCH)).toHaveTextContent('스마트워치 (심박, bpm): 95')
})

it('측정을 끝내는 버튼은 하나뿐이고, 누르면 결과 화면으로 넘어갈 때까지 결과 정리 중으로 잠긴다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74
  state.status = 'connected'; state.latest = { t: 1000, bpm: 92, contact: 'good' }
  let release: (v: unknown) => void = () => {}
  state.stop.mockImplementation(() => new Promise((r) => { release = r }))
  render(<MeasureDemo />)
  fireEvent.click(screen.getByRole('button', { name: '측정 종료' }))
  const busy = await screen.findByRole('button', { name: '결과 정리 중' })
  expect(busy).toBeDisabled()
  expect(busy).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByRole('button', { name: '측정 시작' })).toBeNull()
  fireEvent.click(busy)
  await act(async () => { release(null) })
  // 저장이 끝나 이동을 요청한 뒤에도 화면이 바뀔 때까지 잠김을 풀지 않는다
  const stillBusy = screen.getByRole('button', { name: '결과 정리 중' })
  expect(stillBusy).toBeDisabled()
  expect(stillBusy).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(stillBusy)
  expect(state.stop).toHaveBeenCalledTimes(1)
  expect(state.push).toHaveBeenCalledTimes(1)
  expect(state.push).toHaveBeenCalledWith('/demo/result')
})

it('저장 여부를 아직 고르지 않았으면 처음 한 번 묻고, 그 뒤로는 기록 저장 버튼으로 켜고 끄며 기록 여부가 바뀐다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74; state.status = 'idle'; state.latest = null
  render(<MeasureDemo />)
  const recordValue = () => screen.getByText('기록 여부').closest('[class*="_row_"]')!
  // 고르지 않았으면 묻는 칸이 뜨고, 고르기 전에는 저장하지 않는다
  expect(await screen.findByRole('region', { name: '기록 저장 여부' })).toBeVisible()
  expect(recordValue()).toHaveTextContent('대기 중')
  expect(state.recordingEnabled.at(-1)).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.queryByRole('region', { name: '기록 저장 여부' })).toBeNull()
  expect(recordValue()).toHaveTextContent('저장 중')
  expect(JSON.parse(localStorage.getItem('onmaum_consent')!).record).toBe(true)
  expect(state.recordingEnabled.at(-1)).toBe(true)
  // 고른 뒤에는 모니터링 Info 아래 버튼으로 바꾼다
  fireEvent.click(screen.getByRole('button', { name: '저장 멈춤' }))
  expect(recordValue()).toHaveTextContent('대기 중')
  expect(JSON.parse(localStorage.getItem('onmaum_consent')!).record).toBe(false)
  expect(state.recordingEnabled.at(-1)).toBe(false)
  expect(screen.queryByRole('region', { name: '기록 저장 여부' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '기록 저장' }))
  expect(recordValue()).toHaveTextContent('저장 중')
})

it('위쪽 메뉴 버튼을 누르면 숨 고르기·표정 그림·화면 색 항목이 펼쳐지고, 고르거나 Esc 를 누르면 닫힌다', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74; state.status = 'idle'; state.latest = null
  render(<MeasureDemo />)
  const menuBtn = screen.getByRole('button', { name: '메뉴' })
  expect(menuBtn).toHaveAttribute('aria-expanded', 'false')
  // 글자 링크로 늘어놓지 않는다
  expect(screen.queryByRole('button', { name: '숨 고르기' })).toBeNull()
  fireEvent.click(menuBtn)
  expect(menuBtn).toHaveAttribute('aria-expanded', 'true')
  const items = screen.getAllByRole('menuitem').map((el) => el.textContent)
  // 지난 측정이 없으면 결과 항목은 없다(useStoredSession 모의값 null)
  expect(items).toEqual(['숨 고르기호흡 안내 따라 하기', '표정 그림: 선단색 선으로 그린 얼굴', '표정 그림: 원본팀원이 그린 색 얼굴', '화이트 모드화면 색 바꾸기'])
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(menuBtn).toHaveFocus()
  fireEvent.click(menuBtn)
  fireEvent.click(screen.getByRole('menuitem', { name: /숨 고르기/ }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(await screen.findByRole('dialog')).toBeVisible()
})

it('표정 그림은 기본으로 꺼져 있고, 메뉴에서 선 그림·원본 그림을 골라 감정 이름 오른쪽에 붙이며 이 기기에 기억한다', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  state.webcam = 'ready'; state.modelsReady = true; state.rppgBpm = 74; state.status = 'idle'; state.latest = null
  state.faceEmotion = 'angry'
  const { container } = render(<MeasureDemo />)
  const face = () => container.querySelector('[data-emotion]')
  const pick = (name: RegExp) => {
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByRole('menuitem', { name }))
  }
  expect(screen.getByText('화남')).toBeTruthy()
  expect(face()).toBeNull()

  pick(/표정 그림: 선/)
  expect(face()?.tagName.toLowerCase()).toBe('svg')
  expect(face()?.getAttribute('data-emotion')).toBe('angry')
  // 감정 이름 글자가 있으므로 그림은 화면 읽기에서 숨기고, 글자 오른쪽에 둔다
  expect(face()?.getAttribute('aria-hidden')).toBe('true')
  expect(face()?.previousElementSibling?.textContent).toBe('화남')
  expect(localStorage.getItem('onmaum_demo_face_icons')).toBe('line')

  pick(/표정 그림: 원본/)
  expect(face()?.tagName.toLowerCase()).toBe('img')
  expect(face()?.getAttribute('src')).toBe('/demo/faces/angry.png')
  expect(face()?.getAttribute('alt')).toBe('')
  expect(localStorage.getItem('onmaum_demo_face_icons')).toBe('image')

  // 켜진 방식을 다시 고르면 끈다
  pick(/표정 그림: 원본/)
  expect(face()).toBeNull()
  expect(localStorage.getItem('onmaum_demo_face_icons')).toBe('off')
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
