import { describe, expect, it } from 'vitest'
import {
  demoRecordsToCsv,
  demoState,
  settledDemoState,
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
import { SETTLE_MS } from '@/features/rppg/engine/rppgGate'

const est = (over: Partial<TrackedHeartRate> = {}): TrackedHeartRate => ({ bpm: 80, snrDb: 3, motion: 0.003, models: 1, ...over })

describe('시연 표시 상태', () => {
  it('첫 추정 전과 첫 추정 뒤 12초 미만에는 움직임·신호 품질보다 보류 상태를 우선한다', () => {
    expect(settledDemoState(est(), 100_000, null)).toBe('waiting')
    expect(settledDemoState(est({ motion: 1 }), 1000 + SETTLE_MS - 1, 1000)).toBe('waiting')
    expect(settledDemoState(est(), 1000 + SETTLE_MS, 1000)).toBe('ok')
    expect(settledDemoState(est({ snrDb: -2 }), 1000 + SETTLE_MS, 1000)).toBe('weak')
  })

  it('시작·초기화 뒤 보류한 값은 30초 집계에서 빠진다', () => {
    const run = startDemoRun(0)
    let firstEstimateAt: number | null = null
    for (let i = 0; i < DEMO_SLOTS; i++) {
      if (i === 20) firstEstimateAt = null
      if (firstEstimateAt === null) firstEstimateAt = i * 1000
      const state = settledDemoState(est(), i * 1000, firstEstimateAt)
      recordDemo(run, i * 1000, 80, state === 'ok' ? 80 : null)
    }
    const summary = summarizeDemo(run.slots)
    expect(summary.paired).toBe(8)
    expect(summary.coverage).toBeCloseTo(8 / DEMO_SLOTS)
  })
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
  it.each(Object.keys(rec))('%s 필드가 누락되면 해당 항목을 버린다', (key) => {
    const broken = { ...rec } as Record<string, unknown>
    delete broken[key]
    expect(parseDemoRecords(JSON.stringify([broken, rec]))).toEqual([rec])
  })
  it.each(['startS', 'lagS', 'seconds', 'paired', 'coverage', 'watchMean', 'rppgMean', 'meanAbsDiff', 'matchRate'])('%s 숫자가 문자열이면 버린다', (key) => {
    expect(parseDemoRecords(JSON.stringify([{ ...rec, [key]: '1' }]))).toEqual([])
  })
  it.each([{}, [], '잘못된 값', { seconds: 30, paired: 1 }, { seconds: 30, paired: '1', meanAbsDiff: 1, matchRate: 1 }, { seconds: 30, paired: 31, meanAbsDiff: 1, matchRate: 2 }])('잘못된 lag 구조를 버린다: %j', (lag) => {
    expect(parseDemoRecords(JSON.stringify([{ ...rec, lag }]))).toEqual([])
  })
  it('nullable 필드의 null과 lag의 null은 허용한다', () => {
    const empty = { ...summarizeDemo([null]), startedAt: rec.startedAt, startS: 0, lagS: WATCH_LAG_S }
    expect(parseDemoRecords(JSON.stringify([empty]))).toEqual([empty])
  })
  it('유한하지 않은 수·음수·범위를 벗어난 비율·잘못된 날짜는 버린다', () => {
    for (const over of [{ startS: -1 }, { seconds: 1.5 }, { paired: 2 }, { coverage: 1.1 }, { matchRate: -1 }, { startedAt: '날짜 아님' }]) {
      expect(parseDemoRecords(JSON.stringify([{ ...rec, ...over }]))).toEqual([])
    }
    expect(parseDemoRecords(JSON.stringify([rec]).replace('12.34', '1e400'))).toEqual([])
  })
})
