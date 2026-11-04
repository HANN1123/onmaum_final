import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DemoPanel } from '@/features/rppg/components/RppgLab'
import type { DemoState } from '@/features/rppg/lib/demoCompare'

vi.mock('face-api.js', () => ({ SsdMobilenetv1Options: class {} }))
vi.mock('@/features/camera/lib/faceDetection', () => ({ loadFaceApiModels: vi.fn() }))

describe('실험실 30초 측정 시작 조건', () => {
  const props = {
    running: true, watchConnected: true, blocked: false, run: null, results: [],
    onStart: vi.fn(), onCancel: vi.fn(), onExport: vi.fn(), onClear: vi.fn(),
  }

  it.each<[DemoState, number | null, string]>([
    ['waiting', null, '안정화 중'], ['motion', null, '움직임 감지'],
    ['weak', null, '신호 약함'], ['ok', null, '신호 모으는 중'],
  ])('%s 상태에서 숫자가 없으면 시작을 막고 이유를 보여 준다', (state, bpm, reason) => {
    const onStart = vi.fn()
    render(<DemoPanel {...props} onStart={onStart} live={{ state, bpm, watch: 80 }} />)
    const button = screen.getByRole('button', { name: '30초 측정' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(reason)
    fireEvent.click(button)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('안정화가 끝나 숫자가 표시되면 시작하고, 움직임으로 숨겨지면 다시 비활성화한다', () => {
    const onStart = vi.fn()
    const { rerender } = render(<DemoPanel {...props} onStart={onStart} live={{ state: 'waiting', bpm: null, watch: 80 }} />)
    rerender(<DemoPanel {...props} onStart={onStart} live={{ state: 'ok', bpm: 81, watch: 80 }} />)
    const button = screen.getByRole('button', { name: '30초 측정' })
    expect(button).toBeEnabled()
    expect(screen.getByText('81')).toBeInTheDocument()
    fireEvent.click(button)
    expect(onStart).toHaveBeenCalledOnce()
    rerender(<DemoPanel {...props} live={{ state: 'motion', bpm: null, watch: 80 }} />)
    expect(button).toBeDisabled()
  })
})
