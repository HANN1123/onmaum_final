import { describe, expect, it } from 'vitest'

import {
  abortedRows,
  dueSlots,
  rowsToCsv,
  runKey,
  SLOT_COUNT,
  slotRow,
  type Evaluation,
  type SlotInput,
} from '@/features/rppg/lib/labProtocol'
import { parseLabRows, referenceBpm, summarizePairs, type LabRow, type ReferenceSample } from '@/features/rppg/lib/rppg'

const evaluation: Evaluation = { runId: 'run-1', condition: 'quiet', evalStart: 100_000, nextSlot: 1 }

function input(over: Partial<SlotInput> = {}): SlotInput {
  const slotAt = 115_000
  const est = { bpm: 70, snrDb: 3, windowStart: slotAt - 10_000, windowEnd: slotAt - 200 }
  return {
    evaluation,
    slot: 1,
    now: slotAt + 300,
    startedAt: 90_000,
    estimates: { forehead: est, all: est, me: est },
    reference: { bpm: 72, n: 5, ageS: 1 },
    fps: 30,
    meOutFps: 28,
    meDropped: 0,
    ...over,
  }
}

describe('dueSlots', () => {
  it('첫 슬롯은 평가 시작 15초 뒤다', () => {
    expect(dueSlots(evaluation, 114_999)).toEqual([])
    expect(dueSlots(evaluation, 115_000)).toEqual([1])
  })

  it('밀린 슬롯을 모두 돌려주고 8개를 넘지 않는다', () => {
    expect(dueSlots({ ...evaluation, nextSlot: 2 }, 145_000)).toEqual([2, 3])
    expect(dueSlots({ ...evaluation, nextSlot: 8 }, 999_000)).toEqual([8])
    expect(dueSlots({ ...evaluation, nextSlot: SLOT_COUNT + 1 }, 999_000)).toEqual([])
  })
})

describe('slotRow', () => {
  it('정렬된 추정과 기준값을 남긴다', () => {
    const row = slotRow(input())
    expect(row).toMatchObject({ watch: 72, slot: 1, conditionSec: 15, reason: null, source: 'ble', t: 25 })
    expect(row.me?.bpm).toBe(70)
  })

  it('평가 전 구간이 섞인 창은 비교하지 않는다', () => {
    const est = { bpm: 70, snrDb: 3, windowStart: 99_000, windowEnd: 114_800 }
    const row = slotRow(input({ estimates: { forehead: est, all: est, me: null } }))
    expect(row.forehead).toBeNull()
    expect(row.reason).toBe('no_rppg')
  })

  it('슬롯 시각에서 벗어난 창은 그 추정기만 뺀다', () => {
    const old = { bpm: 70, snrDb: 3, windowStart: 103_000, windowEnd: 112_000 }
    const row = slotRow(input({ estimates: { ...input().estimates, me: old } }))
    expect(row.me).toBeNull()
    expect(row.forehead).not.toBeNull()
    expect(row.reason).toBeNull()
  })

  it('기준값이 없어도 슬롯을 남기고 이유를 적는다', () => {
    const row = slotRow(input({ reference: null }))
    expect(row.watch).toBeNull()
    expect(row.reason).toBe('no_reference')
  })

  it('탭이 멈춰 늦게 처리한 슬롯은 평가에서 뺀다', () => {
    const row = slotRow(input({ now: 120_000 }))
    expect(row).toMatchObject({ watch: null, forehead: null, all: null, me: null, reason: 'timer_late' })
  })
})

describe('abortedRows', () => {
  it('중단하면 남은 슬롯을 실패로 남긴다', () => {
    const rows = abortedRows({ ...evaluation, nextSlot: 7 }, 90_000)
    expect(rows.map((r) => r.slot)).toEqual([7, 8])
    expect(rows.every((r) => r.reason === 'aborted' && r.watch === null)).toBe(true)
  })
})

describe('summarizePairs 자동 평가 집계', () => {
  const est = { bpm: 72, snrDb: 3 }
  const row = (over: Partial<LabRow> = {}): LabRow => ({
    t: 1,
    fps: 30,
    condition: 'quiet',
    watch: 70,
    forehead: est,
    all: est,
    me: est,
    ...over,
  })

  it('실패 슬롯을 분모에 남기고 비율을 나눠 낸다', () => {
    const rows = [
      row(),
      row(),
      row(),
      row({ watch: null }),
      row({ me: null }),
      row({ watch: null, me: null }),
      row(),
      row(),
    ]
    const s = summarizePairs(rows, 0).quiet.me
    expect(s.n).toBe(8)
    expect(s.rppgRate).toBeCloseTo(6 / 8)
    expect(s.refRate).toBeCloseTo(6 / 8)
    expect(s.comparableRate).toBeCloseTo(5 / 8)
    expect(s.mae).toBeCloseTo(2)
  })

  it('목표를 넘으면 충족, 비교 가능 슬롯이 부족하면 판정 불가', () => {
    expect(summarizePairs(Array(8).fill(row()), 0).quiet.me.verdict).toBe('pass')
    const far = { bpm: 90, snrDb: 3 }
    expect(summarizePairs(Array(8).fill(row({ me: far })), 0).quiet.me.verdict).toBe('fail')
    const missing = [...Array(3).fill(row()), ...Array(5).fill(row({ watch: null }))]
    expect(summarizePairs(missing, 0).quiet.me.verdict).toBe('undecided')
    expect(summarizePairs(Array(8).fill(row({ condition: 'move' })), 0).move.me.verdict).toBe('exploratory')
  })

  it('게이트를 통과한 슬롯이 적으면 목표 미달이다', () => {
    const weak = { bpm: 72, snrDb: -3 }
    const rows = [...Array(5).fill(row({ me: weak })), ...Array(3).fill(row())]
    expect(summarizePairs(rows, 0).quiet.me.verdict).toBe('fail')
  })
})

describe('referenceBpm', () => {
  const samples = (times: number[], bpm = 70): ReferenceSample[] =>
    times.map((t) => ({ t, bpm, contact: 'unsupported' }))

  it('최근 10초 평균과 알림 수를 낸다', () => {
    const value = referenceBpm(
      [
        { t: 1_000, bpm: 200, contact: 'unsupported' },
        { t: 12_000, bpm: 70, contact: 'unsupported' },
        { t: 17_000, bpm: 74, contact: 'unsupported' },
      ],
      20_000,
    )
    expect(value).toEqual({ bpm: 72, n: 2, ageS: 3 })
  })

  it('미래 표본과 접촉 불량 표본을 뺀다', () => {
    const rows: ReferenceSample[] = [
      { t: 13_000, bpm: 70, contact: 'good' },
      { t: 17_000, bpm: 70, contact: 'good' },
      { t: 18_000, bpm: 200, contact: 'poor' },
      { t: 25_000, bpm: 200, contact: 'good' },
    ]
    expect(referenceBpm(rows, 20_000)?.bpm).toBe(70)
  })

  it('오래됐거나 부족하거나 공백이 크면 null이다', () => {
    expect(referenceBpm(samples([11_000, 11_500]), 20_000)).toBeNull()
    expect(referenceBpm(samples([19_000]), 20_000)).toBeNull()
    expect(referenceBpm(samples([18_500, 19_500]), 20_000)).toBeNull()
    expect(referenceBpm(samples([10_500, 19_500]), 20_000)).toBeNull()
    expect(referenceBpm([], 20_000)).toBeNull()
  })

  it('같은 BPM이 반복돼도 알림을 지우지 않는다', () => {
    expect(referenceBpm(samples([11_000, 13_000, 15_000, 17_000]), 20_000)?.n).toBe(4)
  })
})

describe('기록 보관', () => {
  it('실행과 출처별로 나눈다', () => {
    const base: LabRow = { t: 1, fps: 30, condition: 'quiet', watch: 70, forehead: null, all: null, me: null }
    expect(runKey({ ...base, runId: 'a', source: 'ble' })).not.toBe(runKey({ ...base, runId: 'a', source: 'manual' }))
    expect(runKey(base)).toContain('이전 기록')
  })

  it('실패 슬롯과 CSV 열이 저장·복원을 거쳐도 유지된다', () => {
    const row = slotRow(input({ reference: null }))
    const [restored] = parseLabRows(JSON.stringify([row]))
    expect(restored).toMatchObject({ watch: null, reason: 'no_reference', slot: 1, runId: 'run-1', source: 'ble' })
    expect(restored.me?.windowEnd).toBe(114_800)

    const csv = rowsToCsv([restored]).split('\n')
    expect(csv[0].split(',')).toHaveLength(csv[1].split(',').length)
    expect(csv[1]).toContain('no_reference')
  })
})
