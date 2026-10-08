# P4 잔여 (개인 기준선 · 체크인 · 넛지 · /stats v2) Implementation Plan

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 온마음 v2의 P4 미구현분(개인 기준선·오전/오후 체크인·안전판 넛지)을 구현하고, `/stats`를 구 flatAffect 위험 시스템에서 2축 P/N 기반 v2 표면으로 마이그레이션한다.

**Architecture:** 순수 로직을 lib(`dailyStress`/`baseline`/`calibration`/`checkin`/`nudge`)로 분리해 TDD하고, 저장(localStorage)은 `settings`/`dayState`에, 화면 배선은 hooks/components에 둔다. 기준선은 원시 `emotions`(Dexie)에서 즉석 산출하며, self-report는 표시 계층 보정 오프셋으로만 N을 조정(원시 기록 불변).

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest + happy-dom, @testing-library/react, Dexie, recharts.

**Spec:** [docs/superpowers/specs/2026-06-14-p4-checkin-nudge-baseline-design.md](../specs/2026-06-14-p4-checkin-nudge-baseline-design.md)

---

## 공통 규약 (모든 태스크)

- 테스트 위치: `tests/lib/*.test.ts`, `tests/hooks/*.test.tsx`, `tests/components/*.test.tsx`.
- 테스트 import: `import { describe, it, expect } from 'vitest'` (globals 켜져 있어도 명시 import — 기존 관례).
- 단일 파일 실행: `npx vitest run <path>`. 전체: `npm run test:run`.
- 경로 별칭 `@/` = 저장소 루트.
- 시간 의존 로직은 `now: Date`를 **인자로 주입**(테스트 결정성; `Date.now()` 직접 호출 금지).
- hook/component는 첫 줄 `'use client'`. effect 내 클라이언트 전용 setState는 기존 패턴대로 `// eslint-disable-next-line react-hooks/set-state-in-effect` 주석.
- 커밋: 그린 확인 후 1태스크 1커밋, 메시지 끝에:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- 브랜치: `feature/p4-checkin-nudge-baseline` (이미 생성·체크아웃됨).

## 파일 구조 & 공유 인터페이스 (순환참조 회피)

의존 방향(화살표 = import): `settings`/`dayState` → {`checkin`,`nudge`,`calibration`,`baseline`}. 순수 lib는 서로/저장소를 import하지 않는다.

| 파일 | 책임 | 정의(export) |
|------|------|------|
| `features/algorithm/stress/dailyStress.ts` | 원시 레코드 → 일별/최근/시간대 P·N (즉석) | `dailyStressFor`, `dailyStressHistory`, `recentStress`, `hardestPeriod`, `DailyStressPoint`, `RECENT_WINDOW_MS`, `PERIOD_BUCKET_HOURS` |
| `features/algorithm/baseline/baseline.ts` | 기준선 상태 + 분류 | `computeBaselineState`, `classifyStress`, `BaselineState`, `BaselineMode`, `StressLevel`, 상수들 |
| `features/algorithm/baseline/calibration.ts` | self-report 보정 오프셋(순수) | `SelfReport`, `nextOffset`, `applyOffset`, `OFFSET_MAX`, `OFFSET_STEP`, `OFFSET_DECAY` |
| `features/feedback/lib/checkin.ts` | 체크인 시간창/노출(순수) | `CheckinSlot`, `CheckinWindow`, `currentSlot`, `checkinDue` |
| `features/feedback/lib/nudge.ts` | 넛지 정책(순수) | `NudgeSettings`, `NudgeDayState`, `SustainState`, `updateSustain`, `shouldNudge` |
| `shared/storage/settings.ts` | 영속 설정(localStorage) | `Settings`, `DEFAULT_SETTINGS`, `loadSettings`, `saveSettings` |
| `shared/storage/dayState.ts` | 일자별 상태(localStorage) | `CheckinEntry`, `loadCheckinDone`, `saveCheckinEntry`, `loadNudgeDayState`, `saveNudgeDayState` |
| `features/feedback/hooks/useCheckin.ts` | 체크인 배선 | `useCheckin` |
| `features/feedback/hooks/useNudge.ts` | 넛지 배선(앱 전역) | `useNudge` |
| `features/feedback/components/CheckInCard.tsx` | 체크인 카드 UI | default |
| `features/feedback/components/NudgeSettings.tsx` | 넛지 설정 UI | default |
| `features/feedback/components/NudgeBanner.tsx` | 인앱 넛지 배너 | default |
| `features/feedback/components/NudgeHost.tsx` | 넛지 hook+배너 마운트 래퍼 | default |
| `features/ui/report/DailyReport.tsx` (수정) | 평소대비·힘든 시간대 추가 | default |
| `features/ui/report/TrendChart.tsx` (수정) | N 추이 + 기준선 점선 | default |
| `app/stats/page.tsx` (수정) | v2 표면 | default |
| `features/ui/common/AppChrome.tsx` (수정) | `useNudge` + `NudgeBanner` 마운트 | default |

---

# Phase A — 개인 기준선 (foundation)

## Task A1: `features/algorithm/stress/dailyStress.ts` — 일별/최근/시간대 P·N 즉석 산출

**Files:**
- Create: `features/algorithm/stress/dailyStress.ts`
- Test: `tests/algorithm/stress/dailyStress.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/algorithm/stress/dailyStress.test.ts
import { describe, it, expect } from 'vitest'
import {
  dailyStressFor,
  dailyStressHistory,
  recentStress,
  hardestPeriod,
  RECENT_WINDOW_MS,
} from '@/features/algorithm/stress/dailyStress'
import type { EmotionRecord } from '@/shared/storage/db'

function rec(partial: Partial<EmotionRecord> & { timestamp: Date; duration: number }): EmotionRecord {
  return {
    id: 0,
    detectionRate: 1,
    happy: 0,
    calm: 0,
    sad: 0,
    angry: 0,
    dominantEmotion: 'calm',
    flatAffectScore: 0,
    ...partial,
  }
}

describe('dailyStressFor', () => {
  it('해당 날짜 레코드만 집계, 없으면 null', () => {
    const records = [
      rec({ timestamp: new Date('2026-06-10T11:00:00'), duration: 1000, angry: 0.4 }),
      rec({ timestamp: new Date('2026-06-11T11:00:00'), duration: 1000, happy: 1 }),
    ]
    const s = dailyStressFor(records, '2026-06-10')!
    expect(s.stress).toBeCloseTo(60) // 0.4×1.5×100
    expect(dailyStressFor(records, '2026-06-12')).toBeNull()
  })
})

describe('dailyStressHistory', () => {
  it('오래된→최근 순, days 길이 고정, 빈 날 scores=null', () => {
    const today = new Date('2026-06-12T09:00:00')
    const records = [rec({ timestamp: new Date('2026-06-11T11:00:00'), duration: 60000, happy: 1 })]
    const hist = dailyStressHistory(records, 3, today)
    expect(hist.map((h) => h.date)).toEqual(['2026-06-10', '2026-06-11', '2026-06-12'])
    expect(hist[0].scores).toBeNull()
    expect(hist[1].scores!.positive).toBeCloseTo(100)
    expect(hist[1].totalDuration).toBe(60000)
    expect(hist[2].scores).toBeNull()
  })
})

describe('recentStress', () => {
  it('now 기준 window 안 레코드만', () => {
    const now = new Date('2026-06-12T12:00:00')
    const records = [
      rec({ timestamp: new Date('2026-06-12T11:00:00'), duration: 1000, angry: 0.4 }), // 60분 전 → 제외
      rec({ timestamp: new Date('2026-06-12T11:50:00'), duration: 1000, happy: 1 }), // 10분 전 → 포함
    ]
    const s = recentStress(records, now, RECENT_WINDOW_MS)!
    expect(s.positive).toBeCloseTo(100)
    expect(s.stress).toBeCloseTo(0)
  })
})

describe('hardestPeriod', () => {
  it('N 최고 2시간 버킷 반환', () => {
    const records = [
      rec({ timestamp: new Date('2026-06-12T10:30:00'), duration: 1000, happy: 1 }),
      rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: 1000, angry: 0.4 }),
    ]
    const p = hardestPeriod(records)!
    expect(p.startHour).toBe(14) // floor(15/2)*2
    expect(p.stress).toBeCloseTo(60)
  })

  it('빈 배열 → null', () => {
    expect(hardestPeriod([])).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/algorithm/stress/dailyStress.test.ts` · Expected: FAIL (`Cannot find module '@/features/algorithm/stress/dailyStress'`)

- [ ] **Step 3: 구현**

```ts
// features/algorithm/stress/dailyStress.ts
import type { EmotionRecord } from '@/shared/storage/db'
import { aggregateStress, type StressScores } from '@/features/algorithm/stress/stressIndex'

export const RECENT_WINDOW_MS = 30 * 60 * 1000
export const PERIOD_BUCKET_HOURS = 2

function localDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD (로컬)
}

export function dailyStressFor(records: EmotionRecord[], date: string): StressScores | null {
  return aggregateStress(records.filter((r) => localDateKey(r.timestamp) === date))
}

export interface DailyStressPoint {
  date: string
  scores: StressScores | null
  totalDuration: number
}

export function dailyStressHistory(
  records: EmotionRecord[],
  days: number,
  today: Date,
): DailyStressPoint[] {
  const out: DailyStressPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = localDateKey(d)
    const dayRecords = records.filter((r) => localDateKey(r.timestamp) === date)
    out.push({
      date,
      scores: aggregateStress(dayRecords),
      totalDuration: dayRecords.reduce((s, r) => s + r.duration, 0),
    })
  }
  return out
}

export function recentStress(
  records: EmotionRecord[],
  now: Date,
  windowMs: number = RECENT_WINDOW_MS,
): StressScores | null {
  const cutoff = now.getTime() - windowMs
  return aggregateStress(records.filter((r) => r.timestamp.getTime() >= cutoff))
}

export function hardestPeriod(
  records: EmotionRecord[],
): { startHour: number; stress: number } | null {
  const byBucket = new Map<number, EmotionRecord[]>()
  for (const r of records) {
    const startHour = Math.floor(r.timestamp.getHours() / PERIOD_BUCKET_HOURS) * PERIOD_BUCKET_HOURS
    const arr = byBucket.get(startHour) ?? []
    arr.push(r)
    byBucket.set(startHour, arr)
  }
  let best: { startHour: number; stress: number } | null = null
  for (const [startHour, arr] of byBucket) {
    const s = aggregateStress(arr)
    if (s && (best === null || s.stress > best.stress)) best = { startHour, stress: s.stress }
  }
  return best
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/algorithm/stress/dailyStress.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/algorithm/stress/dailyStress.ts tests/algorithm/stress/dailyStress.test.ts
git commit -m "feat(dailyStress): 일별·최근·시간대 P/N 즉석 산출 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task A2: `features/algorithm/baseline/baseline.ts` — 기준선 상태 + 4밴드 분류

**Files:**
- Create: `features/algorithm/baseline/baseline.ts`
- Test: `tests/algorithm/baseline/baseline.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/algorithm/baseline/baseline.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeBaselineState,
  classifyStress,
  MIN_VALID_DAYS,
  MIN_VALID_DAY_DURATION_MS,
} from '@/features/algorithm/baseline/baseline'
import type { DailyStressPoint } from '@/features/algorithm/stress/dailyStress'

function pt(date: string, stress: number | null, totalDuration: number): DailyStressPoint {
  return {
    date,
    scores: stress === null ? null : { positive: 0, stress },
    totalDuration,
  }
}

const FIVE_MIN = MIN_VALID_DAY_DURATION_MS

describe('computeBaselineState', () => {
  it('유효일 < MIN_VALID_DAYS → absolute', () => {
    const hist = [pt('d1', 40, FIVE_MIN), pt('d2', 40, FIVE_MIN), pt('today', 50, FIVE_MIN)]
    expect(computeBaselineState(hist)).toEqual({ mode: 'absolute', baselineN: null })
  })

  it('유효일 >= MIN_VALID_DAYS → relative, baselineN = median(오늘 제외)', () => {
    const hist = [
      pt('d1', 10, FIVE_MIN),
      pt('d2', 20, FIVE_MIN),
      pt('d3', 60, FIVE_MIN),
      pt('today', 99, FIVE_MIN), // 오늘은 제외
    ]
    expect(computeBaselineState(hist)).toEqual({ mode: 'relative', baselineN: 20 })
  })

  it('측정 부족일(5분 미만)·빈 날은 유효일에서 제외', () => {
    const hist = [
      pt('d1', 30, FIVE_MIN),
      pt('d2', 30, FIVE_MIN - 1), // 부족
      pt('d3', null, 0), // 빈 날
      pt('today', 30, FIVE_MIN),
    ]
    expect(computeBaselineState(hist).mode).toBe('absolute') // 유효일 1개뿐
  })
})

describe('classifyStress (absolute)', () => {
  const abs = { mode: 'absolute' as const, baselineN: null }
  it('밴드 경계', () => {
    expect(classifyStress(10, abs)).toBe('low') // <15
    expect(classifyStress(15, abs)).toBe('typical') // 15~30
    expect(classifyStress(30, abs)).toBe('typical')
    expect(classifyStress(40, abs)).toBe('high') // 30~50
    expect(classifyStress(60, abs)).toBe('veryHigh') // >50
  })
})

describe('classifyStress (relative)', () => {
  const rel = { mode: 'relative' as const, baselineN: 40 }
  it('비율 밴드', () => {
    expect(classifyStress(20, rel)).toBe('low') // ratio 0.5 < 0.8
    expect(classifyStress(40, rel)).toBe('typical') // ratio 1.0
    expect(classifyStress(56, rel)).toBe('high') // ratio 1.4
    expect(classifyStress(80, rel)).toBe('veryHigh') // ratio 2.0
  })

  it('절대 하한: 기준선이 낮아도 value<20이면 high 승격 안 함', () => {
    const lowBase = { mode: 'relative' as const, baselineN: 5 }
    expect(classifyStress(15, lowBase)).toBe('typical') // ratio 3.0이지만 value<20
    expect(classifyStress(25, lowBase)).toBe('veryHigh') // value>=20 → 승격
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/algorithm/baseline/baseline.test.ts` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// features/algorithm/baseline/baseline.ts
import type { DailyStressPoint } from '@/features/algorithm/stress/dailyStress'

export type StressLevel = 'low' | 'typical' | 'high' | 'veryHigh'
export type BaselineMode = 'absolute' | 'relative'

export interface BaselineState {
  mode: BaselineMode
  baselineN: number | null
}

export const BASELINE_WINDOW_DAYS = 14
export const MIN_VALID_DAY_DURATION_MS = 5 * 60 * 1000
export const MIN_VALID_DAYS = 3
export const ABS_FLOOR_N = 20

export const REL_LOW = 0.8
export const REL_HIGH = 1.25
export const REL_VERY_HIGH = 1.6

export const ABS_LOW = 15
export const ABS_TYPICAL = 30
export const ABS_HIGH = 50

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** history: 오래된→최근(오늘 포함). 마지막(오늘)은 제외하고 기준선 계산. */
export function computeBaselineState(history: DailyStressPoint[]): BaselineState {
  const past = history.slice(0, -1)
  const validN = past
    .filter((p) => p.scores !== null && p.totalDuration >= MIN_VALID_DAY_DURATION_MS)
    .map((p) => p.scores!.stress)
  if (validN.length < MIN_VALID_DAYS) return { mode: 'absolute', baselineN: null }
  return { mode: 'relative', baselineN: median(validN) }
}

export function classifyStress(value: number, baseline: BaselineState): StressLevel {
  if (baseline.mode === 'relative' && baseline.baselineN !== null && baseline.baselineN > 0) {
    const ratio = value / baseline.baselineN
    if (ratio >= REL_VERY_HIGH && value >= ABS_FLOOR_N) return 'veryHigh'
    if (ratio >= REL_HIGH && value >= ABS_FLOOR_N) return 'high'
    if (ratio < REL_LOW) return 'low'
    return 'typical'
  }
  if (value > ABS_HIGH) return 'veryHigh'
  if (value > ABS_TYPICAL) return 'high'
  if (value < ABS_LOW) return 'low'
  return 'typical'
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/algorithm/baseline/baseline.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/algorithm/baseline/baseline.ts tests/algorithm/baseline/baseline.test.ts
git commit -m "feat(baseline): 하이브리드 기준선 + 평소대비 4밴드 분류 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase B — 보정 오프셋 & 저장 계층

## Task B1: `features/algorithm/baseline/calibration.ts` — self-report 보정 오프셋(순수)

**Files:**
- Create: `features/algorithm/baseline/calibration.ts`
- Test: `tests/algorithm/baseline/calibration.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/algorithm/baseline/calibration.test.ts
import { describe, it, expect } from 'vitest'
import { nextOffset, applyOffset, OFFSET_MAX, OFFSET_STEP } from '@/features/algorithm/baseline/calibration'

describe('nextOffset', () => {
  it("'worse' → +STEP, 'better' → -STEP", () => {
    expect(nextOffset(0, 'worse')).toBe(OFFSET_STEP)
    expect(nextOffset(0, 'better')).toBe(-OFFSET_STEP)
  })

  it("'agree' → 0 방향 감쇠", () => {
    expect(nextOffset(5, 'agree')).toBe(4)
    expect(nextOffset(-5, 'agree')).toBe(-4)
    expect(nextOffset(0, 'agree')).toBe(0)
  })

  it('±OFFSET_MAX 클램프', () => {
    expect(nextOffset(OFFSET_MAX, 'worse')).toBe(OFFSET_MAX)
    expect(nextOffset(-OFFSET_MAX, 'better')).toBe(-OFFSET_MAX)
  })
})

describe('applyOffset', () => {
  it('N+offset, 0~100 클램프', () => {
    expect(applyOffset(50, 3)).toBe(53)
    expect(applyOffset(99, 5)).toBe(100)
    expect(applyOffset(2, -5)).toBe(0)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/algorithm/baseline/calibration.test.ts` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// features/algorithm/baseline/calibration.ts
export const OFFSET_MAX = 15
export const OFFSET_STEP = 3
export const OFFSET_DECAY = 1

/** 맞아요 / 더 힘들었어요 / 사실 괜찮았어요 */
export type SelfReport = 'agree' | 'worse' | 'better'

export function nextOffset(current: number, report: SelfReport): number {
  let next = current
  if (report === 'worse') next = current + OFFSET_STEP
  else if (report === 'better') next = current - OFFSET_STEP
  else if (current > 0) next = current - OFFSET_DECAY
  else if (current < 0) next = current + OFFSET_DECAY
  return Math.max(-OFFSET_MAX, Math.min(OFFSET_MAX, next))
}

export function applyOffset(n: number, offset: number): number {
  return Math.max(0, Math.min(100, n + offset))
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/algorithm/baseline/calibration.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/algorithm/baseline/calibration.ts tests/algorithm/baseline/calibration.test.ts
git commit -m "feat(calibration): self-report 보정 오프셋 모델 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task B2: `features/feedback/lib/checkin.ts` — 체크인 시간창/노출(순수)

**Files:**
- Create: `features/feedback/lib/checkin.ts`
- Test: `tests/feedback/lib/checkin.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/feedback/lib/checkin.test.ts
import { describe, it, expect } from 'vitest'
import { currentSlot, checkinDue } from '@/features/feedback/lib/checkin'

const morning = { startHour: 10, endHour: 12 }
const afternoon = { startHour: 15, endHour: 17 }

describe('currentSlot', () => {
  it('창 안/밖 판정 (start 포함, end 미포함)', () => {
    expect(currentSlot(new Date('2026-06-12T10:00:00'), morning, afternoon)).toBe('morning')
    expect(currentSlot(new Date('2026-06-12T11:59:00'), morning, afternoon)).toBe('morning')
    expect(currentSlot(new Date('2026-06-12T12:00:00'), morning, afternoon)).toBeNull()
    expect(currentSlot(new Date('2026-06-12T15:30:00'), morning, afternoon)).toBe('afternoon')
    expect(currentSlot(new Date('2026-06-12T09:00:00'), morning, afternoon)).toBeNull()
  })
})

describe('checkinDue', () => {
  const base = { now: new Date('2026-06-12T10:30:00'), morning, afternoon, doneSlots: [], hasTodayData: true }
  it('창 안 + 미완료 + 데이터 있음 → due', () => {
    expect(checkinDue(base)).toEqual({ due: true, slot: 'morning' })
  })
  it('이미 완료한 창 → due 아님', () => {
    expect(checkinDue({ ...base, doneSlots: ['morning'] })).toEqual({ due: false, slot: 'morning' })
  })
  it('오늘 데이터 없음 → due 아님', () => {
    expect(checkinDue({ ...base, hasTodayData: false })).toEqual({ due: false, slot: 'morning' })
  })
  it('창 밖 → due 아님', () => {
    expect(checkinDue({ ...base, now: new Date('2026-06-12T13:00:00') })).toEqual({ due: false, slot: null })
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/lib/checkin.test.ts` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// features/feedback/lib/checkin.ts
export type CheckinSlot = 'morning' | 'afternoon'
export interface CheckinWindow {
  startHour: number
  endHour: number
}

export function currentSlot(
  now: Date,
  morning: CheckinWindow,
  afternoon: CheckinWindow,
): CheckinSlot | null {
  const h = now.getHours()
  if (h >= morning.startHour && h < morning.endHour) return 'morning'
  if (h >= afternoon.startHour && h < afternoon.endHour) return 'afternoon'
  return null
}

export function checkinDue(args: {
  now: Date
  morning: CheckinWindow
  afternoon: CheckinWindow
  doneSlots: CheckinSlot[]
  hasTodayData: boolean
}): { due: boolean; slot: CheckinSlot | null } {
  const slot = currentSlot(args.now, args.morning, args.afternoon)
  if (!slot || !args.hasTodayData || args.doneSlots.includes(slot)) {
    return { due: false, slot }
  }
  return { due: true, slot }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/lib/checkin.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/lib/checkin.ts tests/feedback/lib/checkin.test.ts
git commit -m "feat(checkin): 오전/오후 시간창 + 노출 판정 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task B3: `features/feedback/lib/nudge.ts` — 넛지 정책(순수)

**Files:**
- Create: `features/feedback/lib/nudge.ts`
- Test: `tests/feedback/lib/nudge.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/feedback/lib/nudge.test.ts
import { describe, it, expect } from 'vitest'
import { updateSustain, shouldNudge, type NudgeSettings, type NudgeDayState } from '@/features/feedback/lib/nudge'

const settings: NudgeSettings = {
  enabled: true,
  maxPerDay: 2,
  cooldownMs: 90 * 60 * 1000,
  sustainMs: 5 * 60 * 1000,
  dndStartHour: null,
  dndEndHour: null,
}
const fresh: NudgeDayState = { count: 0, lastAtMs: null }
const now = new Date('2026-06-12T14:00:00')
const sustained = { level: 'high' as const, highSinceMs: now.getTime() - 6 * 60 * 1000 }

describe('updateSustain', () => {
  it('high 진입 시각 유지, 미달 시 null', () => {
    const t = 1000
    const a = updateSustain(null, 'high', t)
    expect(a.highSinceMs).toBe(t)
    const b = updateSustain(a, 'veryHigh', t + 500)
    expect(b.highSinceMs).toBe(t) // 진입 시각 유지
    const c = updateSustain(b, 'typical', t + 800)
    expect(c.highSinceMs).toBeNull() // 떨어지면 리셋
  })
})

describe('shouldNudge', () => {
  it('모든 조건 충족 → true', () => {
    expect(shouldNudge({ settings, sustain: sustained, dayState: fresh, now })).toBe(true)
  })
  it('토글 off → false', () => {
    expect(shouldNudge({ settings: { ...settings, enabled: false }, sustain: sustained, dayState: fresh, now })).toBe(false)
  })
  it('지속 미달 → false', () => {
    const short = { level: 'high' as const, highSinceMs: now.getTime() - 60 * 1000 }
    expect(shouldNudge({ settings, sustain: short, dayState: fresh, now })).toBe(false)
  })
  it('high 아님 → false', () => {
    expect(shouldNudge({ settings, sustain: { level: 'typical', highSinceMs: null }, dayState: fresh, now })).toBe(false)
  })
  it('빈도 상한 초과 → false', () => {
    expect(shouldNudge({ settings, sustain: sustained, dayState: { count: 2, lastAtMs: null }, now })).toBe(false)
  })
  it('쿨다운 미경과 → false', () => {
    const recent = { count: 1, lastAtMs: now.getTime() - 30 * 60 * 1000 }
    expect(shouldNudge({ settings, sustain: sustained, dayState: recent, now })).toBe(false)
  })
  it('방해금지 시간대 → false', () => {
    const dnd = { ...settings, dndStartHour: 13, dndEndHour: 15 }
    expect(shouldNudge({ settings: dnd, sustain: sustained, dayState: fresh, now })).toBe(false)
  })
  it('자정 넘는 방해금지(22~6시)', () => {
    const night = { ...settings, dndStartHour: 22, dndEndHour: 6 }
    const at23 = new Date('2026-06-12T23:00:00')
    const s = { level: 'high' as const, highSinceMs: at23.getTime() - 6 * 60 * 1000 }
    expect(shouldNudge({ settings: night, sustain: s, dayState: fresh, now: at23 })).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/lib/nudge.test.ts` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// features/feedback/lib/nudge.ts
import type { StressLevel } from '@/features/algorithm/baseline/baseline'

export interface NudgeSettings {
  enabled: boolean
  maxPerDay: number
  cooldownMs: number
  sustainMs: number
  dndStartHour: number | null
  dndEndHour: number | null
}

export interface NudgeDayState {
  count: number
  lastAtMs: number | null
}

export interface SustainState {
  level: StressLevel
  highSinceMs: number | null
}

export function updateSustain(
  prev: SustainState | null,
  level: StressLevel,
  nowMs: number,
): SustainState {
  const isHigh = level === 'high' || level === 'veryHigh'
  if (!isHigh) return { level, highSinceMs: null }
  return { level, highSinceMs: prev?.highSinceMs ?? nowMs }
}

function inDnd(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

export function shouldNudge(args: {
  settings: NudgeSettings
  sustain: SustainState
  dayState: NudgeDayState
  now: Date
}): boolean {
  const { settings, sustain, dayState, now } = args
  if (!settings.enabled) return false
  if (sustain.highSinceMs === null) return false
  if (now.getTime() - sustain.highSinceMs < settings.sustainMs) return false
  if (inDnd(now.getHours(), settings.dndStartHour, settings.dndEndHour)) return false
  if (dayState.count >= settings.maxPerDay) return false
  if (dayState.lastAtMs !== null && now.getTime() - dayState.lastAtMs < settings.cooldownMs) {
    return false
  }
  return true
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/lib/nudge.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/lib/nudge.ts tests/feedback/lib/nudge.test.ts
git commit -m "feat(nudge): 지속+빈도+쿨다운+방해금지 넛지 정책 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task B4: `shared/storage/settings.ts` — 영속 설정 (localStorage)

**Files:**
- Create: `shared/storage/settings.ts`
- Test: `tests/shared/storage/settings.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/shared/storage/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from '@/shared/storage/settings'

describe('settings', () => {
  beforeEach(() => localStorage.clear())

  it('없으면 기본값', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('저장 후 로드', () => {
    const s = { ...DEFAULT_SETTINGS, calibrationOffset: 6, nudge: { ...DEFAULT_SETTINGS.nudge, enabled: true } }
    saveSettings(s)
    expect(loadSettings()).toEqual(s)
  })

  it('부분 저장된 JSON은 기본값과 병합', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ nudge: { enabled: true } }))
    const loaded = loadSettings()
    expect(loaded.nudge.enabled).toBe(true)
    expect(loaded.nudge.maxPerDay).toBe(DEFAULT_SETTINGS.nudge.maxPerDay)
    expect(loaded.morningWindow).toEqual(DEFAULT_SETTINGS.morningWindow)
    expect(loaded.calibrationOffset).toBe(0)
  })

  it('깨진 JSON → 기본값', () => {
    localStorage.setItem(SETTINGS_KEY, '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/shared/storage/settings.test.ts` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// shared/storage/settings.ts
import type { CheckinWindow } from '@/features/feedback/lib/checkin'
import type { NudgeSettings } from '@/features/feedback/lib/nudge'

export const SETTINGS_KEY = 'onmaum_settings'

export interface Settings {
  nudge: NudgeSettings
  morningWindow: CheckinWindow
  afternoonWindow: CheckinWindow
  calibrationOffset: number
}

export const DEFAULT_SETTINGS: Settings = {
  nudge: {
    enabled: false,
    maxPerDay: 2,
    cooldownMs: 90 * 60 * 1000,
    sustainMs: 5 * 60 * 1000,
    dndStartHour: null,
    dndEndHour: null,
  },
  morningWindow: { startHour: 10, endHour: 12 },
  afternoonWindow: { startHour: 15, endHour: 17 },
  calibrationOffset: 0,
}

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const p = JSON.parse(raw) as Partial<Settings>
    return {
      nudge: { ...DEFAULT_SETTINGS.nudge, ...(p.nudge ?? {}) },
      morningWindow: { ...DEFAULT_SETTINGS.morningWindow, ...(p.morningWindow ?? {}) },
      afternoonWindow: { ...DEFAULT_SETTINGS.afternoonWindow, ...(p.afternoonWindow ?? {}) },
      calibrationOffset:
        typeof p.calibrationOffset === 'number' ? p.calibrationOffset : 0,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // 저장 불가 환경은 조용히 무시 (서버 폴백 없음)
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/shared/storage/settings.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add shared/storage/settings.ts tests/shared/storage/settings.test.ts
git commit -m "feat(settings): 넛지/체크인창/보정오프셋 영속 설정 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task B5: `shared/storage/dayState.ts` — 일자별 체크인/넛지 상태 (localStorage)

**Files:**
- Create: `shared/storage/dayState.ts`
- Test: `tests/shared/storage/dayState.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/shared/storage/dayState.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadCheckinDone,
  saveCheckinEntry,
  loadNudgeDayState,
  saveNudgeDayState,
} from '@/shared/storage/dayState'

describe('checkin dayState', () => {
  beforeEach(() => localStorage.clear())

  it('처음엔 완료 슬롯 없음', () => {
    expect(loadCheckinDone('2026-06-12')).toEqual([])
  })

  it('엔트리 저장 → 완료 슬롯에 반영, 날짜 분리', () => {
    saveCheckinEntry('2026-06-12', 'morning', 'agree', 1000)
    expect(loadCheckinDone('2026-06-12')).toEqual(['morning'])
    expect(loadCheckinDone('2026-06-13')).toEqual([])
    saveCheckinEntry('2026-06-12', 'afternoon', 'worse', 2000)
    expect(loadCheckinDone('2026-06-12').sort()).toEqual(['afternoon', 'morning'])
  })
})

describe('nudge dayState', () => {
  beforeEach(() => localStorage.clear())

  it('처음엔 count 0, lastAt null', () => {
    expect(loadNudgeDayState('2026-06-12')).toEqual({ count: 0, lastAtMs: null })
  })

  it('저장 후 로드, 날짜 분리', () => {
    saveNudgeDayState('2026-06-12', { count: 1, lastAtMs: 5000 })
    expect(loadNudgeDayState('2026-06-12')).toEqual({ count: 1, lastAtMs: 5000 })
    expect(loadNudgeDayState('2026-06-13')).toEqual({ count: 0, lastAtMs: null })
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/shared/storage/dayState.test.ts` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// shared/storage/dayState.ts
import type { CheckinSlot } from '@/features/feedback/lib/checkin'
import type { SelfReport } from '@/features/algorithm/baseline/calibration'
import type { NudgeDayState } from '@/features/feedback/lib/nudge'

export interface CheckinEntry {
  slot: CheckinSlot
  report: SelfReport
  atMs: number
}

const checkinKey = (date: string) => `onmaum_checkin_${date}`
const nudgeKey = (date: string) => `onmaum_nudge_${date}`

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 무시
  }
}

export function loadCheckinDone(date: string): CheckinSlot[] {
  const entries = readJson<CheckinEntry[]>(checkinKey(date), [])
  return entries.map((e) => e.slot)
}

export function saveCheckinEntry(
  date: string,
  slot: CheckinSlot,
  report: SelfReport,
  atMs: number,
): void {
  const entries = readJson<CheckinEntry[]>(checkinKey(date), []).filter((e) => e.slot !== slot)
  entries.push({ slot, report, atMs })
  writeJson(checkinKey(date), entries)
}

export function loadNudgeDayState(date: string): NudgeDayState {
  return readJson<NudgeDayState>(nudgeKey(date), { count: 0, lastAtMs: null })
}

export function saveNudgeDayState(date: string, state: NudgeDayState): void {
  writeJson(nudgeKey(date), state)
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/shared/storage/dayState.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add shared/storage/dayState.ts tests/shared/storage/dayState.test.ts
git commit -m "feat(dayState): 일자별 체크인/넛지 상태 저장 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase C — 오전/오후 체크인 (UI 배선)

## Task C1: `features/feedback/components/CheckInCard.tsx` — 체크인 카드 (presentational)

**Files:**
- Create: `features/feedback/components/CheckInCard.tsx`
- Test: `tests/feedback/components/CheckInCard.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/feedback/components/CheckInCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CheckInCard from '@/features/feedback/components/CheckInCard'

describe('CheckInCard', () => {
  it('한 줄 카피와 1탭 버튼 표시', () => {
    render(<CheckInCard slot="morning" line="마음에 힘이 좀 들어가 있었네요" onReport={() => {}} />)
    expect(screen.getByText('마음에 힘이 좀 들어가 있었네요')).toBeTruthy()
    expect(screen.getByRole('button', { name: '맞아요' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '지금은 좀 달라요' })).toBeTruthy()
  })

  it("'맞아요' → onReport('agree')", () => {
    const onReport = vi.fn()
    render(<CheckInCard slot="morning" line="x" onReport={onReport} />)
    fireEvent.click(screen.getByRole('button', { name: '맞아요' }))
    expect(onReport).toHaveBeenCalledWith('agree')
  })

  it("'달라요' → 방향 2지선다 노출 → 'worse'/'better'", () => {
    const onReport = vi.fn()
    render(<CheckInCard slot="afternoon" line="x" onReport={onReport} />)
    fireEvent.click(screen.getByRole('button', { name: '지금은 좀 달라요' }))
    fireEvent.click(screen.getByRole('button', { name: '더 힘들었어요' }))
    expect(onReport).toHaveBeenCalledWith('worse')
  })
})
```

> 참고: `tests/setup.ts`가 `@testing-library/jest-dom`을 로드하므로 `toBeTruthy`/`toBeInTheDocument` 사용 가능. 기존 컴포넌트 테스트 관례를 따른다 (`tests/components/SelfCareTip.test.tsx` 참고).

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/components/CheckInCard.test.tsx` · Expected: FAIL

- [ ] **Step 3: 구현**

```tsx
// features/feedback/components/CheckInCard.tsx
'use client'

import { useState } from 'react'
import type { CheckinSlot } from '@/features/feedback/lib/checkin'
import type { SelfReport } from '@/features/algorithm/baseline/calibration'

interface Props {
  slot: CheckinSlot
  line: string
  onReport: (report: SelfReport) => void
}

const SLOT_LABEL: Record<CheckinSlot, string> = {
  morning: '오전 체크인',
  afternoon: '오후 체크인',
}

export default function CheckInCard({ slot, line, onReport }: Props) {
  const [askDirection, setAskDirection] = useState(false)

  return (
    <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-5">
      <p className="text-xs font-medium text-ink-500">{SLOT_LABEL[slot]}</p>
      <p className="text-base text-ink-900">{line}</p>
      {!askDirection ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReport('agree')}
            className="flex-1 rounded-full bg-risk-good px-4 py-2 text-sm font-medium text-white"
          >
            맞아요
          </button>
          <button
            type="button"
            onClick={() => setAskDirection(true)}
            className="flex-1 rounded-full border border-ink-300 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            지금은 좀 달라요
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReport('worse')}
            className="flex-1 rounded-full border border-ink-300 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            더 힘들었어요
          </button>
          <button
            type="button"
            onClick={() => onReport('better')}
            className="flex-1 rounded-full border border-ink-300 bg-white px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            사실 괜찮았어요
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/components/CheckInCard.test.tsx` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/components/CheckInCard.tsx tests/feedback/components/CheckInCard.test.tsx
git commit -m "feat(CheckInCard): 오전/오후 체크인 카드 + 1탭 self-report (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task C2: `features/feedback/lib/checkinCopy.ts` — 체크인 한 줄 카피 (순수)

**Files:**
- Create: `features/feedback/lib/checkinCopy.ts`
- Test: `tests/feedback/lib/checkinCopy.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/feedback/lib/checkinCopy.test.ts
import { describe, it, expect } from 'vitest'
import { checkinLine } from '@/features/feedback/lib/checkinCopy'

describe('checkinLine', () => {
  it('기준선 있을 때 평소 대비 문구', () => {
    expect(checkinLine('high', 'relative')).toContain('평소보다')
  })
  it('절대 모드 high → 부담 인지 문구 (평소대비 아님)', () => {
    const line = checkinLine('high', 'absolute')
    expect(line).not.toContain('평소보다')
    expect(line.length).toBeGreaterThan(0)
  })
  it('low/typical도 비단정 문구 반환', () => {
    expect(checkinLine('low', 'relative').length).toBeGreaterThan(0)
    expect(checkinLine('typical', 'absolute').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/lib/checkinCopy.test.ts` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// features/feedback/lib/checkinCopy.ts
import type { StressLevel, BaselineMode } from '@/features/algorithm/baseline/baseline'

const RELATIVE: Record<StressLevel, string> = {
  low: '오늘은 평소보다 마음이 가벼워 보여요 🌿',
  typical: '평소와 비슷하게 흘러가고 있어요',
  high: '평소보다 마음에 힘이 좀 들어가 있네요',
  veryHigh: '평소보다 많이 무거운 하루네요. 천천히 가요',
}

const ABSOLUTE: Record<StressLevel, string> = {
  low: '마음이 잔잔해요 🌿',
  typical: '지금은 무던하게 흘러가요',
  high: '마음에 힘이 좀 들어가 있네요',
  veryHigh: '오늘 좀 무거웠죠. 잠깐 숨 돌릴까요?',
}

/** 비단정·토스 톤 체크인 한 줄. 기준선 모드에 따라 '평소 대비' 여부가 달라진다. */
export function checkinLine(level: StressLevel, mode: BaselineMode): string {
  return mode === 'relative' ? RELATIVE[level] : ABSOLUTE[level]
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/lib/checkinCopy.test.ts` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/lib/checkinCopy.ts tests/feedback/lib/checkinCopy.test.ts
git commit -m "feat(checkinCopy): 기준선 모드별 체크인 한 줄 카피 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task C3: `features/feedback/hooks/useCheckin.ts` — 체크인 배선

**Files:**
- Create: `features/feedback/hooks/useCheckin.ts`
- Test: `tests/feedback/hooks/useCheckin.test.tsx`

설명: 오늘 레코드(liveQuery)로 `hasTodayData`·현재값(N′)·기준선·한 줄 카피를 계산하고, `checkinDue`로 노출 여부를 정한다. `submit(report)`는 보정 오프셋을 갱신(저장)하고 체크인 엔트리를 기록한다. 시각은 `now` 주입 가능(기본은 컴포넌트 마운트 시 `new Date()`).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/feedback/hooks/useCheckin.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '@/shared/storage/db'
import { useCheckin } from '@/features/feedback/hooks/useCheckin'
import { loadSettings } from '@/shared/storage/settings'
import { loadCheckinDone } from '@/shared/storage/dayState'

async function seedToday(now: Date) {
  await db.emotions.add({
    timestamp: new Date(now.getTime() - 5 * 60 * 1000),
    duration: 60000,
    detectionRate: 1,
    happy: 0,
    calm: 0,
    sad: 0,
    angry: 0.4,
    dominantEmotion: 'angry',
    flatAffectScore: 0,
  } as never)
}

describe('useCheckin', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.emotions.clear()
  })

  it('창 안 + 오늘 데이터 → due, submit 시 오프셋/엔트리 저장', async () => {
    const now = new Date('2026-06-12T10:30:00')
    await seedToday(now)
    const date = now.toLocaleDateString('en-CA')
    const { result } = renderHook(() => useCheckin({ now }))

    // liveQuery 반영 대기
    await vi.waitFor(() => expect(result.current.due).toBe(true))
    expect(result.current.slot).toBe('morning')
    expect(result.current.line.length).toBeGreaterThan(0)

    await act(async () => {
      result.current.submit('worse')
    })
    expect(loadSettings().calibrationOffset).toBeGreaterThan(0)
    expect(loadCheckinDone(date)).toContain('morning')
  })

  it('창 밖 → due 아님', async () => {
    const now = new Date('2026-06-12T13:00:00')
    await seedToday(now)
    const { result } = renderHook(() => useCheckin({ now }))
    await vi.waitFor(() => expect(result.current.due).toBe(false))
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/hooks/useCheckin.test.tsx` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// features/feedback/hooks/useCheckin.ts
'use client'

import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEmotionsByDate } from '@/shared/storage/emotionRepository'
import { recentStress, dailyStressHistory } from '@/features/algorithm/stress/dailyStress'
import { computeBaselineState, classifyStress, BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { checkinDue, type CheckinSlot } from '@/features/feedback/lib/checkin'
import { checkinLine } from '@/features/feedback/lib/checkinCopy'
import { applyOffset, nextOffset, type SelfReport } from '@/features/algorithm/baseline/calibration'
import { loadSettings, saveSettings } from '@/shared/storage/settings'
import { loadCheckinDone, saveCheckinEntry } from '@/shared/storage/dayState'

interface Args {
  now?: Date
}

interface CheckinView {
  due: boolean
  slot: CheckinSlot | null
  line: string
  submit: (report: SelfReport) => void
}

export function useCheckin({ now = new Date() }: Args = {}): CheckinView {
  const date = now.toLocaleDateString('en-CA')

  const todayRecords = useLiveQuery(() => getEmotionsByDate(date), [date])
  const rangeRecords = useLiveQuery(async () => {
    const start = new Date(now)
    start.setDate(start.getDate() - (BASELINE_WINDOW_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    const { getEmotionsByDateRange } = await import('@/shared/storage/emotionRepository')
    return getEmotionsByDateRange(start, end)
  }, [date])

  const settings = loadSettings()
  const hasTodayData = (todayRecords?.length ?? 0) > 0

  const { due, slot } = checkinDue({
    now,
    morning: settings.morningWindow,
    afternoon: settings.afternoonWindow,
    doneSlots: loadCheckinDone(date),
    hasTodayData,
  })

  let line = ''
  if (due && todayRecords && rangeRecords) {
    const current = recentStress(todayRecords, now)
    const baseline = computeBaselineState(
      dailyStressHistory(rangeRecords, BASELINE_WINDOW_DAYS, now),
    )
    if (current) {
      const adjusted = applyOffset(current.stress, settings.calibrationOffset)
      line = checkinLine(classifyStress(adjusted, baseline), baseline.mode)
    }
  }

  const submit = useCallback(
    (report: SelfReport) => {
      if (!slot) return
      const s = loadSettings()
      saveSettings({ ...s, calibrationOffset: nextOffset(s.calibrationOffset, report) })
      saveCheckinEntry(date, slot, report, now.getTime())
    },
    [slot, date, now],
  )

  return { due, slot, line, submit }
}
```

> 주의: `submit` 후 `loadCheckinDone(date)`가 갱신돼 다음 렌더에서 `due=false`가 된다. liveQuery는 Dexie 변경만 구독하므로, 체크인 완료 후 카드를 숨기려면 소비 측(`/stats`)에서 `submit` 핸들러에 로컬 `dismissed` state를 함께 둔다(Task E3).

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/hooks/useCheckin.test.tsx` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/hooks/useCheckin.ts tests/feedback/hooks/useCheckin.test.tsx
git commit -m "feat(useCheckin): 체크인 노출/카피/보정 배선 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase D — 안전판 넛지 (UI 배선)

## Task D1: `features/feedback/components/NudgeSettings.tsx` — 넛지 설정 UI

**Files:**
- Create: `features/feedback/components/NudgeSettings.tsx`
- Test: `tests/feedback/components/NudgeSettings.test.tsx`

설명: 토글(켜기/끄기) + 하루 빈도 + 방해금지 시간. 켤 때 알림 권한 요청(`useNotificationPermission`). 설정은 `loadSettings`/`saveSettings`.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/feedback/components/NudgeSettings.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NudgeSettings from '@/features/feedback/components/NudgeSettings'
import { loadSettings } from '@/shared/storage/settings'

vi.mock('@/features/feedback/hooks/useNotificationPermission', () => ({
  useNotificationPermission: () => ({
    supported: true,
    permission: 'granted',
    request: vi.fn().mockResolvedValue('granted'),
  }),
}))

describe('NudgeSettings', () => {
  beforeEach(() => localStorage.clear())

  it('토글 켜면 settings.nudge.enabled=true 저장', () => {
    render(<NudgeSettings />)
    const toggle = screen.getByRole('switch', { name: /넛지/ })
    fireEvent.click(toggle)
    expect(loadSettings().nudge.enabled).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/components/NudgeSettings.test.tsx` · Expected: FAIL

- [ ] **Step 3: 구현**

```tsx
// features/feedback/components/NudgeSettings.tsx
'use client'

import { useState } from 'react'
import { useNotificationPermission } from '@/features/feedback/hooks/useNotificationPermission'
import { loadSettings, saveSettings, type Settings } from '@/shared/storage/settings'

export default function NudgeSettings() {
  const { supported, permission, request } = useNotificationPermission()
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  const update = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }

  const toggle = async () => {
    const enabling = !settings.nudge.enabled
    if (enabling && supported && permission === 'default') await request()
    update({ ...settings, nudge: { ...settings.nudge, enabled: enabling } })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">🌿 안전판 넛지</p>
          <p className="mt-1 text-xs text-ink-500">
            마음에 힘이 오래 들어가 있으면 살며시 쉬어가자고 알려드려요
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.nudge.enabled}
          aria-label="넛지 알림"
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            settings.nudge.enabled ? 'bg-risk-good' : 'bg-ink-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              settings.nudge.enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {settings.nudge.enabled && (
        <label className="flex items-center justify-between text-xs text-ink-600">
          하루 최대 알림
          <select
            value={settings.nudge.maxPerDay}
            onChange={(e) =>
              update({
                ...settings,
                nudge: { ...settings.nudge, maxPerDay: Number(e.target.value) },
              })
            }
            className="rounded-lg border border-ink-300 px-2 py-1"
          >
            <option value={1}>1회</option>
            <option value={2}>2회</option>
            <option value={3}>3회</option>
          </select>
        </label>
      )}

      {supported && permission === 'denied' && (
        <p className="text-xs text-ink-400">브라우저 알림이 차단돼 앱 안에서만 알려드려요</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/components/NudgeSettings.test.tsx` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/components/NudgeSettings.tsx tests/feedback/components/NudgeSettings.test.tsx
git commit -m "feat(NudgeSettings): 넛지 토글/빈도 설정 UI (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task D2: `features/feedback/components/NudgeBanner.tsx` — 인앱 넛지 배너

**Files:**
- Create: `features/feedback/components/NudgeBanner.tsx`
- Test: `tests/feedback/components/NudgeBanner.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/feedback/components/NudgeBanner.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NudgeBanner from '@/features/feedback/components/NudgeBanner'

describe('NudgeBanner', () => {
  it('open=false면 렌더 안 함', () => {
    const { container } = render(
      <NudgeBanner open={false} message="x" onClose={() => {}} onMute={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('open=true면 메시지 + 버튼, 콜백 호출', () => {
    const onClose = vi.fn()
    const onMute = vi.fn()
    render(
      <NudgeBanner open message="잠깐 숨 돌릴까요?" onClose={onClose} onMute={onMute} />,
    )
    expect(screen.getByText('잠깐 숨 돌릴까요?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '나중에' }))
    expect(onClose).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '오늘은 그만' }))
    expect(onMute).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/components/NudgeBanner.test.tsx` · Expected: FAIL

- [ ] **Step 3: 구현**

```tsx
// features/feedback/components/NudgeBanner.tsx
'use client'

interface Props {
  open: boolean
  message: string
  onClose: () => void
  onMute: () => void
}

export default function NudgeBanner({ open, message, onClose, onMute }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto w-full max-w-md space-y-3 rounded-2xl border border-risk-good/30 bg-white p-4 shadow-lg">
        <p className="text-sm text-ink-800">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-risk-good px-4 py-2 text-sm font-medium text-white"
          >
            좋아요
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onMute}
            className="rounded-full px-3 py-2 text-xs text-ink-400 hover:text-ink-600"
          >
            오늘은 그만
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/components/NudgeBanner.test.tsx` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/components/NudgeBanner.tsx tests/feedback/components/NudgeBanner.test.tsx
git commit -m "feat(NudgeBanner): 인앱 넛지 배너 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task D3: `features/feedback/hooks/useNudge.ts` — 넛지 배선 (앱 전역)

**Files:**
- Create: `features/feedback/hooks/useNudge.ts`
- Test: `tests/feedback/hooks/useNudge.test.tsx`

설명: 오늘 레코드(liveQuery)로 현재 N′·기준선 level 산출 → `updateSustain`(ref로 누적) → `shouldNudge` → 충족 시 브라우저 Notification(권한 granted일 때) + 인앱 배너 state + `saveNudgeDayState`(count+1, lastAt). 평가 시 `now`는 `new Date()`(테스트는 records 시각으로 sustain을 만족시키도록 시드). 반환: `{ bannerOpen, message, close, muteToday }`.

> 테스트는 순수 정책(Task B3)에서 이미 분기 검증됨. 여기선 "발화 시 배너 open + Notification 호출 + dayState 증가" 통합 경로 1개만 확인한다.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/feedback/hooks/useNudge.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { db } from '@/shared/storage/db'
import { useNudge } from '@/features/feedback/hooks/useNudge'
import { saveSettings, DEFAULT_SETTINGS } from '@/shared/storage/settings'
import { loadNudgeDayState } from '@/shared/storage/dayState'

describe('useNudge', () => {
  beforeEach(async () => {
    localStorage.clear()
    await db.emotions.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal(
      'Notification',
      Object.assign(
        vi.fn().mockImplementation(() => ({ onclick: null, close: vi.fn() })),
        { permission: 'granted' },
      ),
    )
  })

  it('지속 high + 토글 ON → 배너 open + dayState 증가', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      nudge: { ...DEFAULT_SETTINGS.nudge, enabled: true, sustainMs: 0 },
    })
    const now = new Date()
    // 최근 30분 내 high N 레코드
    await db.emotions.add({
      timestamp: new Date(now.getTime() - 60 * 1000),
      duration: 60000,
      detectionRate: 1,
      happy: 0,
      calm: 0,
      sad: 0,
      angry: 0.5, // N = 75
      dominantEmotion: 'angry',
      flatAffectScore: 0,
    } as never)

    const { result } = renderHook(() => useNudge())
    await vi.waitFor(() => expect(result.current.bannerOpen).toBe(true))
    const date = now.toLocaleDateString('en-CA')
    expect(loadNudgeDayState(date).count).toBe(1)
  })

  it('토글 OFF → 배너 안 뜸', async () => {
    const now = new Date()
    await db.emotions.add({
      timestamp: new Date(now.getTime() - 60 * 1000),
      duration: 60000,
      detectionRate: 1,
      happy: 0, calm: 0, sad: 0, angry: 0.5,
      dominantEmotion: 'angry', flatAffectScore: 0,
    } as never)
    const { result } = renderHook(() => useNudge())
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.bannerOpen).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/feedback/hooks/useNudge.test.tsx` · Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// features/feedback/hooks/useNudge.ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getEmotionsByDate, getEmotionsByDateRange } from '@/shared/storage/emotionRepository'
import { recentStress, dailyStressHistory } from '@/features/algorithm/stress/dailyStress'
import { computeBaselineState, classifyStress, BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { applyOffset } from '@/features/algorithm/baseline/calibration'
import { updateSustain, shouldNudge, type SustainState } from '@/features/feedback/lib/nudge'
import { loadSettings } from '@/shared/storage/settings'
import { loadNudgeDayState, saveNudgeDayState } from '@/shared/storage/dayState'

const NUDGE_MESSAGE = '마음에 힘이 들어간 지 좀 됐어요. 잠깐 숨 돌릴까요?'

export function useNudge() {
  const [bannerOpen, setBannerOpen] = useState(false)
  const sustainRef = useRef<SustainState | null>(null)

  const today = new Date().toLocaleDateString('en-CA')
  const todayRecords = useLiveQuery(() => getEmotionsByDate(today), [today])
  const rangeRecords = useLiveQuery(() => {
    const start = new Date()
    start.setDate(start.getDate() - (BASELINE_WINDOW_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return getEmotionsByDateRange(start, end)
  }, [today])

  useEffect(() => {
    if (!todayRecords || !rangeRecords) return
    const now = new Date()
    const settings = loadSettings()

    const current = recentStress(todayRecords, now)
    if (!current) {
      sustainRef.current = updateSustain(sustainRef.current, 'low', now.getTime())
      return
    }
    const adjusted = applyOffset(current.stress, settings.calibrationOffset)
    const baseline = computeBaselineState(
      dailyStressHistory(rangeRecords, BASELINE_WINDOW_DAYS, now),
    )
    const level = classifyStress(adjusted, baseline)
    sustainRef.current = updateSustain(sustainRef.current, level, now.getTime())

    const dayState = loadNudgeDayState(today)
    if (shouldNudge({ settings: settings.nudge, sustain: sustainRef.current, dayState, now })) {
      saveNudgeDayState(today, { count: dayState.count + 1, lastAtMs: now.getTime() })
      setBannerOpen(true)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification('🌿 잠깐 숨 돌릴까요?', {
            body: NUDGE_MESSAGE,
            icon: '/favicon.ico',
            tag: `onmaum-nudge-${today}`,
          })
          n.onclick = () => {
            window.focus()
            n.close()
          }
        } catch (err) {
          console.error('Notification 생성 실패:', err)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRecords, rangeRecords, today])

  const close = useCallback(() => setBannerOpen(false), [])
  const muteToday = useCallback(() => {
    const s = loadNudgeDayState(today)
    saveNudgeDayState(today, { ...s, count: Number.MAX_SAFE_INTEGER })
    setBannerOpen(false)
  }, [today])

  return { bannerOpen, message: NUDGE_MESSAGE, close, muteToday }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/feedback/hooks/useNudge.test.tsx` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/feedback/hooks/useNudge.ts tests/feedback/hooks/useNudge.test.tsx
git commit -m "feat(useNudge): N+기준선 기반 넛지 배선 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task D4: `AppChrome`에 넛지 전역 마운트

**Files:**
- Modify: `features/ui/common/AppChrome.tsx`

`AppChrome`은 이미 `'use client'`이고 랜딩(`/`)에선 chrome을 숨긴다(현재 코드: `if (isLanding) return <>{children}</>`). 넛지는 랜딩에서 돌면 안 되므로(측정 안 함) **비랜딩 분기에만** 마운트한다. 자체 완결적 클라이언트 컴포넌트 `NudgeHost`를 만들어 끼운다(AppChrome 본문에 hook을 직접 넣어 랜딩에서도 호출되는 일 방지).

- [ ] **Step 1: `features/feedback/components/NudgeHost.tsx` 생성**

```tsx
// features/feedback/components/NudgeHost.tsx
'use client'

import { useNudge } from '@/features/feedback/hooks/useNudge'
import NudgeBanner from '@/features/feedback/components/NudgeBanner'

export default function NudgeHost() {
  const nudge = useNudge()
  return (
    <NudgeBanner
      open={nudge.bannerOpen}
      message={nudge.message}
      onClose={nudge.close}
      onMute={nudge.muteToday}
    />
  )
}
```

- [ ] **Step 2: `features/ui/common/AppChrome.tsx` 비랜딩 분기에 `<NudgeHost />` 추가**

```tsx
// import 추가
import NudgeHost from '@/features/feedback/components/NudgeHost'

// 비랜딩 return을 아래로 교체:
return (
  <>
    <Navigation />
    <div className="flex-1">{children}</div>
    <ContactsFooter />
    <NudgeHost />
  </>
)
```

- [ ] **Step 3: 빌드/타입 확인** — Run: `npx tsc --noEmit` · Expected: 에러 없음

- [ ] **Step 4: 전체 테스트** — Run: `npm run test:run` · Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add features/ui/common/AppChrome.tsx features/feedback/components/NudgeHost.tsx
git commit -m "feat(nudge): AppChrome 비랜딩 분기에 넛지 전역 마운트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Phase E — /stats v2 마이그레이션

## Task E1: `DailyReport` v2 — 평소 대비 배지 + 힘들었던 시간대

**Files:**
- Modify: `features/ui/report/DailyReport.tsx`
- Test: `tests/ui/report/DailyReport.test.tsx` (신규)

설명: 기존 P/N 게이지 + 회복 제안은 유지하되, ① N′(보정) 적용, ② 기준선 배지(평소 대비), ③ 힘들었던 시간대 추가. `records`(오늘) 외에 기준선 계산용 `historyRecords`(최근 14일)와 `offset`을 props로 받는다(상위 /stats에서 주입 → 테스트 용이).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/ui/report/DailyReport.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DailyReport from '@/features/ui/report/DailyReport'
import type { EmotionRecord } from '@/shared/storage/db'

function rec(p: Partial<EmotionRecord> & { timestamp: Date; duration: number }): EmotionRecord {
  return { id: 0, detectionRate: 1, happy: 0, calm: 0, sad: 0, angry: 0, dominantEmotion: 'calm', flatAffectScore: 0, ...p }
}

describe('DailyReport v2', () => {
  beforeEach(() => localStorage.clear())

  it('데이터 없으면 안내', () => {
    render(<DailyReport records={[]} historyRecords={[]} offset={0} now={new Date('2026-06-12T18:00:00')} />)
    expect(screen.getByText(/충분하지 않아요/)).toBeTruthy()
  })

  it('힘들었던 시간대 표시', () => {
    const now = new Date('2026-06-12T18:00:00')
    const records = [rec({ timestamp: new Date('2026-06-12T15:10:00'), duration: 60000, angry: 0.4 })]
    render(<DailyReport records={records} historyRecords={records} offset={0} now={now} />)
    expect(screen.getByText(/시/)).toBeTruthy() // "14–16시" 형태 시간대 표기
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/ui/report/DailyReport.test.tsx` · Expected: FAIL

- [ ] **Step 3: 구현 (기존 파일 교체)**

```tsx
// features/ui/report/DailyReport.tsx
'use client'

import { useEffect, useState } from 'react'
import type { EmotionRecord } from '@/shared/storage/db'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { aggregateStress } from '@/features/algorithm/stress/stressIndex'
import { dailyStressHistory, hardestPeriod, PERIOD_BUCKET_HOURS } from '@/features/algorithm/stress/dailyStress'
import { computeBaselineState, classifyStress, BASELINE_WINDOW_DAYS, type StressLevel } from '@/features/algorithm/baseline/baseline'
import { applyOffset } from '@/features/algorithm/baseline/calibration'
import { topTwoEmotions } from '@/features/ui/orb/lib/orbColor'
import { loadProfile, type Profile } from '@/shared/storage/profile'
import { suggestionFor } from '@/features/feedback/lib/selfCareSuggestion'

function averageEmotion(records: EmotionRecord[]): EmotionResult {
  const total = records.reduce((sum, r) => sum + r.duration, 0)
  if (total <= 0) return { happy: 0, calm: 1, sad: 0, angry: 0 }
  const acc = { happy: 0, calm: 0, sad: 0, angry: 0 }
  for (const r of records) {
    acc.happy += r.happy * r.duration
    acc.calm += r.calm * r.duration
    acc.sad += r.sad * r.duration
    acc.angry += r.angry * r.duration
  }
  return { happy: acc.happy / total, calm: acc.calm / total, sad: acc.sad / total, angry: acc.angry / total }
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-600">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
      </div>
    </div>
  )
}

const LEVEL_BADGE: Record<StressLevel, { text: string; cls: string }> = {
  low: { text: '평소보다 가벼움', cls: 'bg-risk-good/10 text-risk-good' },
  typical: { text: '평소와 비슷', cls: 'bg-ink-100 text-ink-600' },
  high: { text: '평소보다 높음', cls: 'bg-risk-caution/10 text-risk-caution' },
  veryHigh: { text: '평소보다 많이 높음', cls: 'bg-risk-warning/10 text-risk-warning' },
}

interface Props {
  records: EmotionRecord[]
  historyRecords: EmotionRecord[]
  offset: number
  now?: Date
}

export default function DailyReport({ records, historyRecords, offset, now = new Date() }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  useEffect(() => {
    // localStorage는 클라이언트에서만 — hydration mismatch 방지 의도적 setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(loadProfile())
  }, [])

  const scores = aggregateStress(records)
  if (!scores) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-5 text-center text-sm text-ink-500">
        아직 오늘 기록이 충분하지 않아요
      </div>
    )
  }

  const adjustedN = applyOffset(scores.stress, offset)
  const baseline = computeBaselineState(dailyStressHistory(historyRecords, BASELINE_WINDOW_DAYS, now))
  const level = classifyStress(adjustedN, baseline)
  const badge = LEVEL_BADGE[level]

  const hard = hardestPeriod(records)
  const [dominant] = topTwoEmotions(averageEmotion(records))
  const suggestion = suggestionFor(dominant, profile)

  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink-900">오늘도 고생했어요</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}>{badge.text}</span>
      </div>
      <div className="space-y-3">
        <Gauge label="긍정" value={scores.positive} color="linear-gradient(90deg,#9bd6a0,#f2c94c)" />
        <Gauge label="스트레스" value={adjustedN} color="linear-gradient(90deg,#f0b39f,#e8806a)" />
      </div>
      {hard && (
        <p className="text-xs text-ink-500">
          힘들었던 시간대: {hard.startHour}–{hard.startHour + PERIOD_BUCKET_HOURS}시
        </p>
      )}
      <div className="rounded-xl bg-risk-good/10 p-3 text-sm text-ink-800">{suggestion}</div>
    </div>
  )
}
```

> `/demo`도 `DailyReport`를 쓰므로(P5) props 변경에 맞춰 Task E3에서 demo 호출부도 갱신한다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/ui/report/DailyReport.test.tsx` · Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add features/ui/report/DailyReport.tsx tests/ui/report/DailyReport.test.tsx
git commit -m "feat(DailyReport): 평소대비 배지 + 힘든 시간대 + N′ 적용 (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task E2: `TrendChart` — N 추이 + 기준선 점선

**Files:**
- Modify: `features/ui/report/TrendChart.tsx`

설명: 막대를 `negativeRatio`(0~1) 대신 일별 **N(스트레스 0~100)**로 바꾸고, 기준선(median)을 `ReferenceLine` 점선으로 표시. risk 색/평탄도 제거. 데이터는 `dailyStressHistory` 사용.

- [ ] **Step 1: 구현 (기존 파일 교체)**

```tsx
// features/ui/report/TrendChart.tsx
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getEmotionsByDateRange } from '@/shared/storage/emotionRepository'
import { dailyStressHistory } from '@/features/algorithm/stress/dailyStress'
import { computeBaselineState } from '@/features/algorithm/baseline/baseline'

const DAYS = 7

function formatDateLabel(date: string): string {
  return date.slice(5).replace('-', '/')
}

interface ChartPoint {
  date: string
  label: string
  stress: number
  hasData: boolean
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-ink-900">{p.label}</p>
      {p.hasData ? (
        <p className="mt-1 text-ink-600">스트레스 {Math.round(p.stress)}</p>
      ) : (
        <p className="mt-1 text-ink-400">데이터 없음</p>
      )}
    </div>
  )
}

export default function TrendChart() {
  const today = new Date().toLocaleDateString('en-CA')
  const records = useLiveQuery(() => {
    const start = new Date()
    start.setDate(start.getDate() - (DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return getEmotionsByDateRange(start, end)
  }, [today])

  if (records === undefined) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center text-sm text-ink-500">
        ⏳ 추세 불러오는 중...
      </div>
    )
  }

  const history = dailyStressHistory(records, DAYS, new Date())
  const data: ChartPoint[] = history.map((h) => ({
    date: h.date,
    label: formatDateLabel(h.date),
    stress: h.scores ? h.scores.stress : 0,
    hasData: h.scores !== null,
  }))
  const baseline = computeBaselineState(history)
  const hasAnyData = data.some((d) => d.hasData)

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-700">최근 7일 스트레스</p>
        {baseline.mode === 'relative' && baseline.baselineN !== null && (
          <p className="text-xs text-ink-500">평소선 {Math.round(baseline.baselineN)}</p>
        )}
      </div>

      {!hasAnyData && <p className="mb-3 text-center text-xs text-ink-400">7일 내 집계 데이터가 없습니다</p>}

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#737373' }} axisLine={{ stroke: '#E5E5E5' }} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#737373' }} axisLine={{ stroke: '#E5E5E5' }} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#FAFAFA' }} />
            {baseline.mode === 'relative' && baseline.baselineN !== null && (
              <ReferenceLine y={baseline.baselineN} stroke="#A3A3A3" strokeDasharray="4 4" />
            )}
            <Bar dataKey="stress" radius={[4, 4, 0, 0]} fill="#e8806a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입 확인** — Run: `npx tsc --noEmit` · Expected: 에러 없음

- [ ] **Step 3: 기존 TrendChart 테스트 확인** — TrendChart 전용 테스트가 없으면(검색: `tests/components/TrendChart*`) 생략. 있으면 N 기준으로 갱신.

- [ ] **Step 4: 커밋**

```bash
git add features/ui/report/TrendChart.tsx
git commit -m "feat(TrendChart): 최근 7일 N 추이 + 기준선 점선

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task E3: `app/stats/page.tsx` — v2 표면으로 교체 + demo 호출부 갱신

**Files:**
- Modify: `app/stats/page.tsx`
- Modify: `app/demo/page.tsx` (DailyReport props)

- [ ] **Step 1: `/stats` 교체**

```tsx
// app/stats/page.tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import CheckInCard from '@/features/feedback/components/CheckInCard'
import DailyReport from '@/features/ui/report/DailyReport'
import NudgeSettings from '@/features/feedback/components/NudgeSettings'
import RecentRecords from '@/features/ui/report/RecentRecords'
import TrendChart from '@/features/ui/report/TrendChart'
import { useCheckin } from '@/features/feedback/hooks/useCheckin'
import { getEmotionsByDate, getEmotionsByDateRange } from '@/shared/storage/emotionRepository'
import { loadSettings } from '@/shared/storage/settings'
import { BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'

export default function StatsPage() {
  const today = new Date().toLocaleDateString('en-CA')
  const [checkinDismissed, setCheckinDismissed] = useState(false)

  const todayRecords = useLiveQuery(() => getEmotionsByDate(today), [today])
  const historyRecords = useLiveQuery(() => {
    const start = new Date()
    start.setDate(start.getDate() - (BASELINE_WINDOW_DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return getEmotionsByDateRange(start, end)
  }, [today])

  const checkin = useCheckin()
  const offset = loadSettings().calibrationOffset

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-ink-900">오늘</h1>
          <p className="mt-2 text-sm text-ink-500">마음 한눈에 보기</p>
        </header>

        {checkin.due && checkin.slot && !checkinDismissed && (
          <CheckInCard
            slot={checkin.slot}
            line={checkin.line}
            onReport={(r) => {
              checkin.submit(r)
              setCheckinDismissed(true)
            }}
          />
        )}

        <DailyReport
          records={todayRecords ?? []}
          historyRecords={historyRecords ?? []}
          offset={offset}
        />
        <TrendChart />
        <NudgeSettings />
        <RecentRecords />
      </section>
    </main>
  )
}
```

- [ ] **Step 2: `/demo` DailyReport 호출부 갱신** — `app/demo/page.tsx`에서 `<DailyReport records={...} />`를 새 시그니처로:

```tsx
<DailyReport records={demoRecords} historyRecords={demoRecords} offset={0} />
```
(데모는 기준선 데이터가 없어 absolute 모드로 동작 — 의도된 동작.)

- [ ] **Step 3: 네비 라벨 갱신** — `features/ui/common/Navigation.tsx`의 `{ href: '/stats', label: '통계' }`를 `label: '오늘'`로 변경(표면 성격 변화 반영).

- [ ] **Step 4: 타입 + 전체 테스트** — Run: `npx tsc --noEmit && npm run test:run` · Expected: 에러 없음 / 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add app/stats/page.tsx app/demo/page.tsx features/ui/common/Navigation.tsx
git commit -m "feat(stats): /stats를 v2 표면(체크인+리포트+넛지설정+추이)으로 교체

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task E4: 구 Step6 위험 시스템 은퇴 (정리)

**Files:**
- Delete: `components/DailyRiskCard.tsx`, `components/RiskWarningModal.tsx`, `components/SelfCareTip.tsx`, `components/NotificationToggle.tsx`, `hooks/useRiskNotification.ts`, `hooks/useWarningDismissal.ts` 및 각 테스트
- Modify: `features/algorithm/stress/riskCalculator.ts` (상수만 유지)

> **선행 확인 필수:** 삭제 전 각 심볼이 다른 곳에서 import되지 않는지 검증한다. `ANGRY_WEIGHT`/`MIN_RECORD_DURATION_MS`는 `stressIndex.ts` 등에서 사용되므로 **삭제 금지**.

- [ ] **Step 1: 참조 확인** — Run:
```bash
grep -rn "DailyRiskCard\|RiskWarningModal\|SelfCareTip\|NotificationToggle\|useRiskNotification\|useWarningDismissal" app components hooks --include="*.tsx" --include="*.ts" | grep -v -E "components/(DailyRiskCard|RiskWarningModal|SelfCareTip|NotificationToggle)\.tsx|hooks/(useRiskNotification|useWarningDismissal)\.ts"
```
Expected: 출력 없음(= 어디서도 안 씀). 출력 있으면 먼저 그 참조 제거.

- [ ] **Step 2: `riskCalculator.ts`에서 상수만 남기기** — `calculateRiskLevel`, `aggregateDailyRisk`, `DailyRisk`, `RiskLevel`, 임계 상수 제거. 단 이들이 다른 곳(예: `aggregateDailyRisk`를 더 이상 아무도 안 씀)에서 미사용임을 grep으로 확인 후 제거. 최종 파일:

```ts
// features/algorithm/stress/riskCalculator.ts
/**
 * 화남 인식률 보정 가중치. (memory: project_step4_anger_compensation)
 * stressIndex 등에서 재사용.
 */
export const ANGRY_WEIGHT = 1.5

/** 너무 짧은 record는 노이즈로 간주하여 집계에서 제외. */
export const MIN_RECORD_DURATION_MS = 10000
```
> `RiskLevel`/`aggregateDailyRisk`가 남은 곳에서 쓰이면(grep 확인) 그 사용처도 v2로 교체하거나, 안전하게 해당 함수는 보존. **grep 결과에 따라 결정** — 미사용일 때만 삭제.

- [ ] **Step 3: 미사용 컴포넌트/훅/테스트 삭제** — Step 1에서 무참조 확인된 것만:

```bash
git rm components/DailyRiskCard.tsx components/RiskWarningModal.tsx components/SelfCareTip.tsx components/NotificationToggle.tsx \
       hooks/useRiskNotification.ts hooks/useWarningDismissal.ts \
       tests/components/RiskWarningModal.test.tsx tests/components/SelfCareTip.test.tsx tests/components/NotificationToggle.test.tsx \
       tests/hooks/useRiskNotification.test.tsx tests/hooks/useWarningDismissal.test.tsx
```
> `riskCalculator.test.ts`는 상수만 테스트하도록 정리(또는 제거). `useNotificationPermission`은 `NudgeSettings`가 쓰므로 **유지**.

- [ ] **Step 4: 타입 + 전체 테스트 + 빌드** — Run: `npx tsc --noEmit && npm run test:run && npm run build` · Expected: 에러 없음 / 전부 PASS / 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore(stats): 구 Step6 flatAffect 위험 시스템 은퇴 (v2 원칙 §4·§20)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

## Task E5: 수동 검증 (run/verify 스킬)

- [ ] **Step 1: 앱 실행 후 확인** — `superpowers` 외 `verify`/`run` 스킬로 dev 서버를 띄워 `/measure`에서 측정 → `/stats`(오늘)에서:
  - 체크인 카드(시간창 안일 때) 표시 + 맞아요/달라요 동작
  - 오늘 P/N 게이지 + 평소대비 배지 + 힘든 시간대
  - 최근 7일 N 추이 + 기준선 점선(데이터 ≥3일 시)
  - 넛지 토글 ON 후 지속 high 시 배너/알림
- [ ] **Step 2: 콘솔 에러 없음 확인**

---

## Self-Review (작성자 체크)

**1. Spec coverage**
- §2 기준선(D1·D2) ✓ — `baseline.ts` 하이브리드/median/4밴드, dailyStress 즉석.
- §3 체크인(C1·C2·C3) ✓ — 시간창/due/카피/self-report/보정.
- §4 보정 오프셋(B1) ✓ — nextOffset/applyOffset, 원시 불변(표시계층 적용).
- §5(스펙 §7) 넛지(B3·D1·D2·D3·D4) ✓ — 지속/빈도/쿨다운/DND/토글, flatAffect 제거.
- §8 /stats 마이그레이션(E1~E4) ✓ — 리포트 v2/추이 N/구 시스템 은퇴.
- §9 데이터 흐름 ✓ — emotions→dailyStress→baseline→{체크인·리포트·넛지}, offset 표시계층.
- §11 테스트 ✓ — 각 순수 lib TDD.
- §12 비목표 ✓ — Dexie 롤업 없음, EmotionDisplay 제거는 미포함(노트).

**2. Placeholder scan** — "TBD/대충" 없음. Task D4/E4는 기존 파일 구조·grep 결과에 의존하므로 "확인 후 적용" 분기를 명시(플레이스홀더 아님, 조건부 실행).

**3. Type consistency**
- `StressLevel`/`BaselineState`/`BaselineMode` (baseline) — checkinCopy/nudge/DailyReport/useCheckin/useNudge에서 동일 사용 ✓
- `SelfReport` (calibration) — CheckInCard/useCheckin/dayState 동일 ✓
- `CheckinSlot`/`CheckinWindow` (checkin) — settings/dayState/CheckInCard/useCheckin 동일 ✓
- `NudgeSettings`/`NudgeDayState`/`SustainState` (nudge) — settings/useNudge/dayState 동일 ✓
- `DailyStressPoint` (dailyStress) — baseline/TrendChart 동일 ✓
- `aggregateStress`/`StressScores` (stressIndex 기존) 재사용 ✓
- 순환참조 회피: 순수 lib는 settings/dayState를 import하지 않음 ✓

**4. 알려진 제약(문서화)**
- 넛지 평가 cadence는 레코드 write 시점(세션 종료)에 의존 — 데모/제품 수준 충분, 실시간 분해능은 후순위.
- 체크인 카드 숨김은 liveQuery가 localStorage를 구독하지 않으므로 소비측 `dismissed` state로 처리(Task E3).
