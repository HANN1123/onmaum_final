// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  initialWidgetState,
  reduceWidgetState,
  resolveWidgetPosition,
  shouldShowWidget,
  WIDGET_MARGIN,
  WIDGET_SIZE,
  type WidgetEvent,
  type WidgetState,
} from '@/features/electron/main/widgetRules'
import { widgetStatus } from '@/features/electron/types/widgetStatus'
import type { MeasurementSnapshot } from '@/features/electron/types/bridge'

const snap = (o: Partial<MeasurementSnapshot> = {}): MeasurementSnapshot => ({
  active: true,
  emotions: { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 },
  recordCount: 3,
  videoFps: 30,
  saveFailed: false,
  sentAt: 0,
  ...o,
})

const run = (state: WidgetState, ...events: WidgetEvent[]) => events.reduce(reduceWidgetState, state)

describe('shouldShowWidget', () => {
  it('설정 켬 + 최소화 + 측정 중이면 보인다', () => {
    const s = run(initialWidgetState(true), { type: 'snapshot', snapshot: snap(), now: 1 }, { type: 'minimize' })
    expect(shouldShowWidget(s)).toBe(true)
  })

  it('설정을 끄면 숨고, 다시 켜면 보인다', () => {
    let s = run(initialWidgetState(true), { type: 'snapshot', snapshot: snap(), now: 1 }, { type: 'minimize' })
    s = reduceWidgetState(s, { type: 'setEnabled', enabled: false })
    expect(shouldShowWidget(s)).toBe(false)
    s = reduceWidgetState(s, { type: 'setEnabled', enabled: true })
    expect(shouldShowWidget(s)).toBe(true)
  })

  it('측정 중이 아닐 때 최소화하면 보이지 않는다', () => {
    const s = run(
      initialWidgetState(true),
      { type: 'snapshot', snapshot: snap({ active: false }), now: 1 },
      { type: 'minimize' },
    )
    expect(shouldShowWidget(s)).toBe(false)
  })

  it('최소화되지 않았으면 측정 중이어도 보이지 않는다', () => {
    const s = run(initialWidgetState(true), { type: 'snapshot', snapshot: snap(), now: 1 })
    expect(shouldShowWidget(s)).toBe(false)
  })

  it('최소화된 동안 측정이 끝나면 "측정 꺼짐"으로 남는다', () => {
    const s = run(
      initialWidgetState(true),
      { type: 'snapshot', snapshot: snap(), now: 1 },
      { type: 'minimize' },
      { type: 'snapshot', snapshot: snap({ active: false }), now: 2 },
    )
    expect(shouldShowWidget(s)).toBe(true)
    expect(s.view.endedWhileMinimized).toBe(true)
    expect(widgetStatus(s.view, 3)).toBe('stopped')
  })

  it('복원하면 숨고 "측정 끝남" 기억은 지워진다', () => {
    let s = run(
      initialWidgetState(true),
      { type: 'snapshot', snapshot: snap(), now: 1 },
      { type: 'minimize' },
      { type: 'snapshot', snapshot: snap({ active: false }), now: 2 },
      { type: 'restore' },
    )
    expect(shouldShowWidget(s)).toBe(false)
    expect(s.view.endedWhileMinimized).toBe(false)
    // 다음 최소화 구간은 새로 시작: 측정 중이 아니므로 보이지 않는다
    s = reduceWidgetState(s, { type: 'minimize' })
    expect(shouldShowWidget(s)).toBe(false)
  })

  it('측정 화면이 사라지면 이전 active를 무효화한다', () => {
    const s = run(
      initialWidgetState(true),
      { type: 'snapshot', snapshot: snap(), now: 1 },
      { type: 'minimize' },
      { type: 'measurementLost', now: 5 },
    )
    expect(s.view.snapshot?.active).toBe(false)
    expect(s.view.endedWhileMinimized).toBe(true)
  })

  it('측정 중이 아니면 measurementLost는 아무것도 바꾸지 않는다', () => {
    const s0 = initialWidgetState(true)
    expect(reduceWidgetState(s0, { type: 'measurementLost', now: 1 })).toBe(s0)
  })

  it('상태가 바뀔 때마다 순번이 늘어난다', () => {
    const s0 = initialWidgetState(true)
    const s1 = reduceWidgetState(s0, { type: 'snapshot', snapshot: snap(), now: 1 })
    const s2 = reduceWidgetState(s1, { type: 'minimize' })
    expect(s1.view.seq).toBeGreaterThan(s0.view.seq)
    expect(s2.view.seq).toBeGreaterThan(s1.view.seq)
  })
})

describe('widgetStatus', () => {
  const at = (...events: WidgetEvent[]) => run(initialWidgetState(true), ...events).view

  it('정상 신호면 측정 중', () => {
    expect(widgetStatus(at({ type: 'snapshot', snapshot: snap(), now: 1000 }), 2000)).toBe('measuring')
  })

  it('스냅샷이 5초 넘게 오지 않으면 확인 필요', () => {
    const v = at({ type: 'snapshot', snapshot: snap(), now: 1000 })
    expect(widgetStatus(v, 6000)).toBe('measuring')
    expect(widgetStatus(v, 6001)).toBe('attention')
  })

  it('프레임이 0이거나 알 수 없는 상태가 5초 이어지면 확인 필요', () => {
    const v = at(
      { type: 'snapshot', snapshot: snap({ videoFps: 0 }), now: 1000 },
      { type: 'snapshot', snapshot: snap({ videoFps: null }), now: 4000 },
      { type: 'snapshot', snapshot: snap({ videoFps: 0 }), now: 6000 },
    )
    expect(v.noFramesSince).toBe(1000)
    expect(widgetStatus(v, 5999)).toBe('measuring')
    expect(widgetStatus(v, 6000)).toBe('attention')
  })

  it('프레임이 다시 들어오면 회복한다', () => {
    const v = at(
      { type: 'snapshot', snapshot: snap({ videoFps: 0 }), now: 1000 },
      { type: 'snapshot', snapshot: snap({ videoFps: 12 }), now: 7000 },
    )
    expect(v.noFramesSince).toBeNull()
    expect(widgetStatus(v, 7500)).toBe('measuring')
  })

  it('저장이 실패하면 확인 필요', () => {
    const v = at({ type: 'snapshot', snapshot: snap({ saveFailed: true }), now: 1000 })
    expect(widgetStatus(v, 1500)).toBe('attention')
  })

  it('감정 결과 없음(얼굴 미검출·분석 실패)이 30초 이어지면 확인 필요, 결과가 나오면 회복', () => {
    const v = at(
      { type: 'snapshot', snapshot: snap({ emotions: null }), now: 1000 },
      { type: 'snapshot', snapshot: snap({ emotions: null }), now: 20_000 },
    )
    expect(v.noEmotionSince).toBe(1000)
    // heartbeat는 계속 온다고 보고 감정 결과 공백만 본다
    expect(widgetStatus({ ...v, receivedAt: 30_999 }, 30_999)).toBe('measuring')
    expect(widgetStatus({ ...v, receivedAt: 31_000 }, 31_000)).toBe('attention')
    const back = at(
      { type: 'snapshot', snapshot: snap({ emotions: null }), now: 1000 },
      { type: 'snapshot', snapshot: snap(), now: 32_000 },
    )
    expect(back.noEmotionSince).toBeNull()
    expect(widgetStatus(back, 32_500)).toBe('measuring')
  })

  it('스냅샷이 없으면 측정 꺼짐', () => {
    expect(widgetStatus(initialWidgetState(true).view, 0)).toBe('stopped')
  })
})

describe('resolveWidgetPosition', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 }
  const second = { x: 1920, y: 0, width: 1280, height: 984 }
  const fallback = {
    x: 1920 - WIDGET_SIZE.width - WIDGET_MARGIN,
    y: 1040 - WIDGET_SIZE.height - WIDGET_MARGIN,
  }

  it('저장 위치가 없으면 주 모니터 오른쪽 아래', () => {
    expect(resolveWidgetPosition(null, [primary], primary)).toEqual(fallback)
  })

  it('작업 영역 안이면 그대로 쓴다(다른 모니터 포함)', () => {
    expect(resolveWidgetPosition({ x: 100, y: 100 }, [primary, second], primary)).toEqual({ x: 100, y: 100 })
    expect(resolveWidgetPosition({ x: 2000, y: 50 }, [primary, second], primary)).toEqual({ x: 2000, y: 50 })
  })

  it('일부만 걸치거나 밖이면 기본 위치로 되돌린다', () => {
    expect(resolveWidgetPosition({ x: 1850, y: 100 }, [primary], primary)).toEqual(fallback)
    expect(resolveWidgetPosition({ x: -500, y: -500 }, [primary, second], primary)).toEqual(fallback)
    expect(resolveWidgetPosition({ x: 100, y: 1000 }, [primary], primary)).toEqual(fallback)
  })
})
