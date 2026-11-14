import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import type { EmotionRecordInput } from '@/shared/storage/emotionRepository'
import { createMeasureRecorder, MAX_SAMPLE_GAP_MS, type RecorderDeps } from '@/features/ui/measure/demo/measureRecorder'
import { storageRowText } from '@/features/ui/measure/demo/storageStatus'

const CALM: EmotionResult = { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 }
const ANGRY: EmotionResult = { happy: 0.05, calm: 0.15, sad: 0.1, angry: 0.7 }

function fakeDeps(opts: { failSession?: boolean; failSave?: boolean } = {}) {
  let now = 0
  const saved: EmotionRecordInput[] = []
  const calls: string[] = []
  const deps: RecorderDeps = {
    startSession: vi.fn(async () => {
      calls.push('start')
      if (opts.failSession) throw new Error('세션 실패')
      return { id: 's1' }
    }),
    touchSession: vi.fn(async () => { calls.push('touch') }),
    endSession: vi.fn(async () => { calls.push('end') }),
    saveRecord: vi.fn(async (r: EmotionRecordInput) => {
      calls.push('save')
      if (opts.failSave) throw new Error('저장 실패')
      saved.push(r)
      return saved.length
    }),
    now: () => now,
  }
  return { deps, saved, calls, setNow: (t: number) => { now = t } }
}

/** from(제외)~to(포함) 사이를 step 간격으로 push */
function feed(recorder: ReturnType<typeof createMeasureRecorder>, setNow: (t: number) => void, from: number, to: number, e: EmotionResult | null, step = 250) {
  for (let t = from + step; t <= to; t += step) {
    setNow(t)
    recorder.push(e)
  }
}

afterEach(() => vi.restoreAllMocks())

describe('createMeasureRecorder: 새 측정 화면 1분 감정 기록 저장', () => {
  it('1분마다 묶어 세션 id 와 함께 저장하고, 종료 때 남은 표본까지 저장한 뒤 세션을 끝낸다', async () => {
    const { deps, saved, calls, setNow } = fakeDeps()
    const recorder = createMeasureRecorder(deps, { nominalIntervalMs: 250 })
    feed(recorder, setNow, 0, 60_000, CALM)
    feed(recorder, setNow, 60_000, 80_000, ANGRY)
    const status = await recorder.stop()
    expect(saved).toHaveLength(2)
    expect(saved.map((r) => r.sessionId)).toEqual(['s1', 's1'])
    expect(saved.map((r) => r.dominantEmotion)).toEqual(['calm', 'angry'])
    expect(saved[0].timestamp.getTime()).toBe(60_000)
    expect(saved[1].timestamp.getTime()).toBe(80_000)
    expect(status).toEqual({ saved: 2, failed: false, sessionId: 's1' })
    // 30초마다 세션 생존 갱신, 마지막은 세션 종료
    expect(calls.filter((c) => c === 'touch').length).toBe(2)
    expect(calls.at(-1)).toBe('end')
  })

  it('stop 은 여러 번 불러도 한 번만 처리하고, 종료 뒤 표본은 버린다', async () => {
    const { deps, saved, setNow } = fakeDeps()
    const recorder = createMeasureRecorder(deps, { nominalIntervalMs: 250 })
    feed(recorder, setNow, 0, 5_000, CALM)
    const a = recorder.stop()
    const b = recorder.stop()
    expect(a).toBe(b)
    feed(recorder, setNow, 5_000, 70_000, ANGRY)
    await a
    expect(saved).toHaveLength(1)
    expect(deps.endSession).toHaveBeenCalledTimes(1)
  })

  it('얼굴을 못 찾은 표본뿐이면 기록을 만들지 않고, 검출 공백은 표본당 최대 1초로 센다', async () => {
    const { deps, saved, setNow } = fakeDeps()
    const recorder = createMeasureRecorder(deps, { nominalIntervalMs: 250 })
    feed(recorder, setNow, 0, 10_000, null)
    setNow(20_000)
    recorder.push(CALM) // 10초 공백 뒤 표본
    setNow(20_250)
    recorder.push(null)
    await recorder.stop()
    expect(saved).toHaveLength(1)
    // 검출 표본은 하나이고 그 간격은 1초로 잘린다
    expect(saved[0].duration).toBe(MAX_SAMPLE_GAP_MS)
  })

  it('세션 생성이 실패해도 기록은 세션 없이 저장하고 세션 종료는 부르지 않는다', async () => {
    const { deps, saved, setNow } = fakeDeps({ failSession: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const recorder = createMeasureRecorder(deps, { nominalIntervalMs: 250 })
    feed(recorder, setNow, 0, 3_000, CALM)
    const status = await recorder.stop()
    expect(saved).toHaveLength(1)
    expect(saved[0].sessionId).toBeUndefined()
    expect(status.sessionId).toBeNull()
    expect(deps.endSession).not.toHaveBeenCalled()
  })

  it('저장이 실패하면 실패를 알리고 세션은 끝낸다', async () => {
    const { deps, setNow } = fakeDeps({ failSave: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    const recorder = createMeasureRecorder(deps, { nominalIntervalMs: 250, onChange })
    feed(recorder, setNow, 0, 3_000, CALM)
    const status = await recorder.stop()
    expect(status).toEqual({ saved: 0, failed: true, sessionId: 's1' })
    expect(onChange).toHaveBeenLastCalledWith({ saved: 0, failed: true, sessionId: 's1' })
    expect(deps.endSession).toHaveBeenCalledTimes(1)
  })
})

describe('storageRowText: 측정 화면 기록 저장 행', () => {
  const yes = { version: 1 as const, record: true, decidedAt: '2026-11-09T00:00:00.000Z' }
  it('동의 상태와 저장 건수·실패를 구분한다', () => {
    expect(storageRowText(undefined, true, null)).toBe('확인 중')
    expect(storageRowText(null, true, null)).toContain('선택 전')
    expect(storageRowText({ ...yes, record: false }, true, null)).toContain('저장 안 함')
    expect(storageRowText(yes, false, null)).toBe('측정하면 1분마다 저장')
    expect(storageRowText(yes, true, { saved: 0, failed: false, sessionId: 's1' })).toBe('저장 중 · 1분마다 기록')
    expect(storageRowText(yes, true, { saved: 3, failed: false, sessionId: 's1' })).toBe('저장 중 · 3건 저장')
    expect(storageRowText(yes, true, { saved: 1, failed: true, sessionId: 's1' })).toContain('저장 실패')
  })
})
