import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CallChart from '@/features/ui/measure/demo/CallChart'
import type { TimelinePoint } from '@/features/ui/measure/demo/sessionLog'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('출처별 불투명도를 기본선·강조선 모두에 적용하고 단일 표본도 점으로 보여 준다', () => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: (entries: { contentRect: { width: number; height: number } }[]) => void) {}
    observe() { this.callback([{ contentRect: { width: 600, height: 240 } }]) }
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const points: TimelinePoint[] = [
    { t: 0, bpm: 70, source: 'rppg', emotion: null },
    { t: 1, bpm: 80, source: 'watch', emotion: null },
    { t: 2, bpm: null, emotion: null },
    { t: 3, bpm: 90, source: 'watch', emotion: null },
    { t: 7, bpm: 72, source: 'rppg', emotion: null },
  ]
  const { container } = render(<CallChart points={points} smooth={points.map((p) => p.bpm)} durationSec={7}
    highlight={{ start: 0, end: 7, emotion: 'calm' }} shares={{ happy: 0, calm: 0, sad: 0, angry: 0 }}
    scheme="dark" active={null} onScrub={vi.fn()} />)
  const groups = container.querySelectorAll('g[opacity]')
  expect([...groups].map((g) => g.getAttribute('opacity'))).toEqual(['0.55', '1', '1', '0.55'])
  for (const group of groups) {
    expect(group.querySelectorAll('path')).toHaveLength(2)
    expect(group.querySelector('circle')).not.toBeNull()
  }
  // 3초 워치 표본과 7초 카메라 표본은 MAX_JOIN_GAP_SEC(3초)를 넘는 공백이라 잇지 않는다.
  expect(groups[3].querySelector('path')?.getAttribute('d')).not.toContain('L')
  expect(screen.getByText('심박 출처 · 워치 진하게 / 카메라 옅게')).toBeVisible()
})
