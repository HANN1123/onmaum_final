import { describe, expect, it } from 'vitest'
import {
  demoRecordsToCsv,
  demoState,
  parseDemoRecords,
  recentMedian,
  recordDemo,
  startDemoRun,
  summarizeDemo,
  DEMO_MOTION_LIMIT,
  DEMO_SLOTS,
  DEMO_TOTAL_MS,
  WATCH_LAG_S,
  type DemoRecord,
} from '@/features/rppg/lib/demoCompare'
import type { TrackedHeartRate } from '@/features/rppg/lib/hrEstimator'

const est = (over: Partial<TrackedHeartRate> = {}): TrackedHeartRate => ({ bpm: 80, snrDb: 3, motion: 0.003, models: 1, ...over })

describe('시연 표시 상태', () => {
  it('움직임이 기준을 넘으면 숫자를 숨긴다', () => {
    expect(demoState(est({ motion: DEMO_MOTION_LIMIT + 0.01 }))).toBe('motion')
  })
  it('SNR 이 낮으면 약한 신호', () => {
    expect(demoState(est({ snrDb: -2 }))).toBe('weak')
  })
  it('상자 기록이 없으면 움직임은 판단하지 않는다', () => {
    expect(demoState(est({ motion: null }))).toBe('ok')
  })
  it('추정이 없으면 기다린다', () => {
    expect(demoState(null)).toBe('waiting')
  })
})

describe('최근 심박 중앙값', () => {
  it('최근 5초 값의 중앙값', () => {
    const pts = [
      { t: 1000, bpm: 200 },
      { t: 7000, bpm: 80 },
      { t: 8000, bpm: 82 },
      { t: 9000, bpm: 120 },
    ]
    expect(recentMedian(pts, 10_000)).toBe(82)
    expect(recentMedian([], 10_000)).toBeNull()
  })
})

describe('시연 결과 집계', () => {
  it('짝지은 칸만 차이를 내고, 숨긴 칸은 표시율에서 뺀다', () => {
    const r = summarizeDemo([
      { t: 1, watch: 80, rppg: 82 },
      { t: 2, watch: 80, rppg: 90 },
      { t: 3, watch: 81, rppg: null },
      { t: 4, watch: null, rppg: 79 },
    ])
    expect(r.seconds).toBe(4)
    expect(r.paired).toBe(2)
    expect(r.meanAbsDiff).toBe(6)
    expect(r.matchRate).toBe(0.5)
    expect(r.coverage).toBe(0.75)
  })
  it('짝이 없으면 차이는 null', () => {
    expect(summarizeDemo([{ t: 1, watch: 80, rppg: null }]).meanAbsDiff).toBeNull()
  })
})

describe('시연 시간 칸 기록', () => {
  it('경과 시간으로 칸을 채우고, 타이머가 밀려 빠진 칸은 분모에 남긴다', () => {
    const run = startDemoRun(0)
    expect(recordDemo(run, 500, 80, 81)).toBe(false)
    // 첫 칸 다음 콜백이 20초 뒤에 왔다: 1~19번 칸은 비어 있다
    expect(recordDemo(run, 20_500, 80, 82)).toBe(false)
    // 30초가 지나도 워치 지연 보정값을 더 받는다
    expect(recordDemo(run, 30_100, 80, 83)).toBe(false)
    expect(recordDemo(run, DEMO_TOTAL_MS + 100, 80, 83)).toBe(true)
    const r = summarizeDemo(run.slots)
    expect(r.seconds).toBe(DEMO_SLOTS)
    expect(r.paired).toBe(2)
    expect(r.coverage).toBeCloseTo(2 / DEMO_SLOTS)
  })

  it('같은 칸에 두 번 들어오면 처음 값만 쓴다', () => {
    const run = startDemoRun(1000)
    recordDemo(run, 1100, 80, 81)
    recordDemo(run, 1900, 80, 99)
    expect(run.slots[0]?.rppg).toBe(81)
  })
})

describe('워치 지연 보정', () => {
  it('rPPG 칸 i 를 WATCH_LAG_S 초 뒤 워치 칸과 비교한다', () => {
    const run = startDemoRun(0)
    // 심박이 80 → 90 으로 바뀌는데 rPPG 는 바로, 워치는 WATCH_LAG_S 초 늦게 따라간다
    for (let i = 0; i * 1000 <= DEMO_TOTAL_MS; i++) {
      const rppg = i < 10 ? 80 : 90
      const watch = i < 10 + WATCH_LAG_S ? 80 : 90
      recordDemo(run, i * 1000 + 100, watch, i < DEMO_SLOTS ? rppg : null)
    }
    const r = summarizeDemo(run.slots, run.lagWatch)
    expect(r.meanAbsDiff).toBeCloseTo((WATCH_LAG_S * 10) / DEMO_SLOTS)
    expect(r.lag?.meanAbsDiff).toBe(0)
    expect(r.lag?.paired).toBe(DEMO_SLOTS)
  })

  it('보정용 워치 값이 없으면 lag 는 null', () => {
    expect(summarizeDemo([{ t: 0, watch: 80, rppg: 80 }]).lag).toBeNull()
  })
})

describe('시연 기록 저장·CSV', () => {
  const rec: DemoRecord = {
    ...summarizeDemo([{ t: 0, watch: 80, rppg: 82 }], [80, 80, 80, 80, 80, 80, 81]),
    startedAt: '2026-11-04T13:00:00.000Z',
    startS: 12.34,
    lagS: WATCH_LAG_S,
  }
  it('회차별 한 줄로 내보내고 열 수가 맞는다', () => {
    const [head, line] = demoRecordsToCsv([rec]).split('\n')
    const cols = head.split(',')
    const cells = line.split(',')
    expect(cols).toHaveLength(cells.length)
    expect(cells[cols.indexOf('mean_abs_diff')]).toBe('2.00')
    expect(cells[cols.indexOf('lag_mean_abs_diff')]).toBe('1.00')
    expect(cells[cols.indexOf('start_s')]).toBe('12.3')
  })
  it('저장한 기록을 다시 읽고, 형식이 다른 항목은 버린다', () => {
    expect(parseDemoRecords(JSON.stringify([rec, { foo: 1 }]))).toHaveLength(1)
    expect(parseDemoRecords('not json')).toEqual([])
  })
})
