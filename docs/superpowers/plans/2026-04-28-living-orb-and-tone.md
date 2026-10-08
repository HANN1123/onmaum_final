# Living Orb + 톤 통합 Implementation Plan

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랜딩(`/`) ↔ 앱(`/measure`, `/stats`)의 시각·타이포·모션 언어를 통일하고, 시간이 쌓일수록 자라나는 "Living Orb"를 도입해 사용자에게 "내 구"라는 정체성을 부여한다.

**Architecture:** 4계층 분리 — (1) 순수 함수(`features/ui/orb/lib/orbStages.ts`, `lib/orbAxes.ts`, `lib/weeklyEmotion.ts`)는 TDD 엄격, (2) 상태/사이드이펙트 hook(`useTheme`, `useLivingOrb`, `useMilestone`)도 TDD, (3) 시각 컴포넌트(`LivingOrb` SVG, `ThemeToggle`, `MilestoneToast`)는 props/렌더 테스트, (4) 통합(layout, page, 기존 컴포넌트 톤 정리)은 best-effort 수동 검증. CSS Variables + `data-theme` 토큰으로 다크/라이트 한 페이지에서 둘 다.

**Tech Stack:** TypeScript 5, Next.js 16.2 (App Router), React 19.2, Tailwind v4 (`@theme inline`), CSS Variables, SVG, Dexie 4.4 + dexie-react-hooks, Vitest 4.1 + @testing-library/react + happy-dom + fake-indexeddb. Three.js·복잡한 Canvas 회피.

**Spec 참조:** `docs/superpowers/specs/2026-04-28-living-orb-and-tone-design.md`

**메모리 참조:**
- `feedback_skill_invocation.md` — TDD/verification 명시 적용 약속
- `feedback_design_target_user_lens.md` — 감정노동자 관점에서 디자인 점검
- `project_living_orb_design.md` — 핵심 결정 요약
- `project_step4_anger_compensation.md` — angry weight 1.5 (saturation 계산 시 일관)

---

## File Structure

```
lib/
  orbStages.ts                  (신규) 5단계 정의 + count→stage
  orbAxes.ts                    (신규) 4축 매핑 함수 (opacity/hue/saturation/motion)
  weeklyEmotion.ts              (신규) 7일 record 집계 (duration 가중)
  riskCalculator.ts             (변경 없음, ANGRY_WEIGHT만 import)
  emotionAnalysis.ts            (변경 없음)
  db.ts                         (변경 없음 — 테이블명: db.emotions)

hooks/
  useTheme.ts                   (신규) light/dark/auto + localStorage + 자동 분기
  useLivingOrb.ts               (신규) 4축 실시간 계산 (DB + active emotion)
  useMilestone.ts               (신규) stage 상승 감지 → toast 트리거

components/
  ThemeProvider.tsx             (신규) Context + html.data-theme
  ThemeToggle.tsx               (신규) 3-mode 토글
  LivingOrb.tsx                 (신규) SVG 5단계 시각
  LivingOrbProvider.tsx         (신규) liveEmotion + active 상태
  LivingOrbHost.tsx             (신규) 우상단 fixed position 호스트
  MilestoneToast.tsx            (신규) 단계 전환 toast
  ReactiveOrb.tsx               (변경) 라이트 variant 색 팔레트 분기
  Navigation.tsx                (변경) 톤 통일 + ThemeToggle
  LandingNav.tsx                (변경) ThemeToggle 통합 + 라이트 모드 색
  ContactsFooter.tsx            (변경) 톤 통일 + 이모지 제거
  LandingFooter.tsx             (변경) 라이트 모드 색
  EmotionDisplay.tsx            (변경) CSS var 기반 색
  DailyRiskCard.tsx             (변경) 동일
  TrendChart.tsx                (변경) 동일
  RecentRecords.tsx             (변경) 동일
  SelfCareTip.tsx               (변경) 동일

app/
  globals.css                   (변경) data-theme 토큰 + CSS vars + @keyframes orbBreathe
  layout.tsx                    (변경) 인라인 theme init script + ThemeProvider + LivingOrbProvider + LivingOrbHost + MilestoneToast
  measure/page.tsx              (변경) — 라벨 패턴, 이모지 제거, 다크 톤, LivingOrbInput 연결
  stats/page.tsx                (변경) — 동일

tests/
  lib/
    orbStages.test.ts           (신규)
    orbAxes.test.ts             (신규)
    weeklyEmotion.test.ts       (신규)
  hooks/
    useTheme.test.ts            (신규)
    useLivingOrb.test.tsx       (신규)
    useMilestone.test.ts        (신규)
  components/
    LivingOrb.test.tsx          (신규)
    ThemeToggle.test.tsx        (신규)
    MilestoneToast.test.tsx     (신규)
```

---

## Pre-flight

- [ ] **PF-1: 베이스라인 테스트가 통과하는지 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run
```

Expected: `Test Files 12 passed (12) | Tests 75 passed | 4 skipped`. 만약 다르면 plan 시작 전 사용자에게 보고.

- [ ] **PF-2: 작업 브랜치 만들기 (선택)**

```bash
git checkout -b living-orb
```

또는 메인 브랜치에서 진행. 사용자 결정.

---

## Task 1: `features/ui/orb/lib/orbStages.ts` — 5단계 정의 (TDD)

**Files:**
- Create: `features/ui/orb/lib/orbStages.ts`
- Create: `tests/ui/orb/lib/orbStages.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/ui/orb/lib/orbStages.test.ts
import { describe, it, expect } from 'vitest'
import {
  STAGE_THRESHOLDS,
  STAGE_MESSAGES,
  STAGE_ORDER,
  stageFromCount,
  isStageHigher,
  type OrbStage,
} from '@/features/ui/orb/lib/orbStages'

describe('orbStages', () => {
  it('STAGE_THRESHOLDS 가 spec 합의값', () => {
    expect(STAGE_THRESHOLDS).toEqual({
      empty: 0,
      awakening: 1,
      forming: 4,
      settled: 11,
      living: 31,
    })
  })

  it('STAGE_ORDER 는 empty→living 순서', () => {
    expect(STAGE_ORDER).toEqual(['empty', 'awakening', 'forming', 'settled', 'living'])
  })

  it('STAGE_MESSAGES 는 5단계 모두 한글 메시지', () => {
    const stages: OrbStage[] = ['empty', 'awakening', 'forming', 'settled', 'living']
    for (const s of stages) {
      expect(STAGE_MESSAGES[s]).toMatch(/[가-힣]/)
    }
  })

  it.each([
    [0, 'empty'],
    [1, 'awakening'],
    [3, 'awakening'],
    [4, 'forming'],
    [10, 'forming'],
    [11, 'settled'],
    [30, 'settled'],
    [31, 'living'],
    [9999, 'living'],
  ])('stageFromCount(%i) = %s', (count, expected) => {
    expect(stageFromCount(count)).toBe(expected)
  })

  it('stageFromCount 은 음수도 empty', () => {
    expect(stageFromCount(-5)).toBe('empty')
  })

  it('isStageHigher: forming > empty', () => {
    expect(isStageHigher('forming', 'empty')).toBe(true)
  })

  it('isStageHigher: empty > forming = false', () => {
    expect(isStageHigher('empty', 'forming')).toBe(false)
  })

  it('isStageHigher: 같은 단계 = false', () => {
    expect(isStageHigher('forming', 'forming')).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/ui/orb/lib/orbStages.test.ts
```

Expected: 모든 테스트 FAIL (모듈 없음).

- [ ] **Step 3: 구현 작성**

```ts
// features/ui/orb/lib/orbStages.ts
export type OrbStage = 'empty' | 'awakening' | 'forming' | 'settled' | 'living'

export const STAGE_THRESHOLDS: Record<OrbStage, number> = {
  empty: 0,
  awakening: 1,
  forming: 4,
  settled: 11,
  living: 31,
}

export const STAGE_ORDER: OrbStage[] = [
  'empty',
  'awakening',
  'forming',
  'settled',
  'living',
]

export const STAGE_MESSAGES: Record<OrbStage, string> = {
  empty: '아직 당신을 모릅니다',
  awakening: '조금씩 느껴지기 시작',
  forming: '당신의 결이 보이기 시작',
  settled: '당신의 결이 분명해집니다',
  living: '당신과 함께 살아갑니다',
}

export function stageFromCount(count: number): OrbStage {
  if (count >= STAGE_THRESHOLDS.living) return 'living'
  if (count >= STAGE_THRESHOLDS.settled) return 'settled'
  if (count >= STAGE_THRESHOLDS.forming) return 'forming'
  if (count >= STAGE_THRESHOLDS.awakening) return 'awakening'
  return 'empty'
}

export function isStageHigher(a: OrbStage, b: OrbStage): boolean {
  return STAGE_ORDER.indexOf(a) > STAGE_ORDER.indexOf(b)
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/ui/orb/lib/orbStages.test.ts
```

Expected: 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add features/ui/orb/lib/orbStages.ts tests/ui/orb/lib/orbStages.test.ts
git commit -m "feat: lib/orbStages — 5단계 정의 + count→stage TDD"
```

---

## Task 2: `lib/orbAxes.ts` — 4축 매핑 함수 (TDD)

**Files:**
- Create: `lib/orbAxes.ts`
- Create: `tests/lib/orbAxes.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/lib/orbAxes.test.ts
import { describe, it, expect } from 'vitest'
import {
  opacityFromCount,
  hueFromWeeklyEmotion,
  saturationFromIntensity,
  motionFromFrequency,
} from '@/lib/orbAxes'

describe('opacityFromCount', () => {
  it('count 0 → 0.15 (Empty 시각 표현)', () => {
    expect(opacityFromCount(0)).toBeCloseTo(0.15, 5)
  })

  it('count 31 → 1.0 (Living 도달)', () => {
    expect(opacityFromCount(31)).toBeCloseTo(1.0, 2)
  })

  it('count 5 → 약 0.55 (로그 곡선 초반 성장)', () => {
    const v = opacityFromCount(5)
    expect(v).toBeGreaterThan(0.5)
    expect(v).toBeLessThan(0.6)
  })

  it('count 10 → 약 0.71', () => {
    const v = opacityFromCount(10)
    expect(v).toBeGreaterThan(0.69)
    expect(v).toBeLessThan(0.73)
  })

  it('count >> 31 도 1.0 clamp', () => {
    expect(opacityFromCount(9999)).toBe(1)
  })

  it('음수도 0.15 floor', () => {
    expect(opacityFromCount(-5)).toBeCloseTo(0.15, 5)
  })
})

describe('hueFromWeeklyEmotion', () => {
  it('happy 100% → 노란색 영역 (R≈242, G≈201, B≈76)', () => {
    const hue = hueFromWeeklyEmotion({ happy: 1, calm: 0, sad: 0, angry: 0 })
    expect(hue).toBe('rgb(242,201,76)')
  })

  it('calm 100% → 청록 (#6BAB9A)', () => {
    expect(hueFromWeeklyEmotion({ happy: 0, calm: 1, sad: 0, angry: 0 })).toBe(
      'rgb(107,171,154)',
    )
  })

  it('happy 50 + calm 50 → 평균 색', () => {
    const hue = hueFromWeeklyEmotion({ happy: 0.5, calm: 0.5, sad: 0, angry: 0 })
    // R = (242+107)/2 = 174.5 → 175 (round), G = (201+171)/2 = 186, B = (76+154)/2 = 115
    expect(hue).toBe('rgb(175,186,115)')
  })

  it('합계 0이면 기본 청록', () => {
    expect(hueFromWeeklyEmotion({ happy: 0, calm: 0, sad: 0, angry: 0 })).toBe(
      'rgb(107,171,154)',
    )
  })
})

describe('saturationFromIntensity', () => {
  it('negativeRatio 0, flatAffect 1 → 기본값 0.3', () => {
    expect(saturationFromIntensity(0, 1)).toBeCloseTo(0.3, 5)
  })

  it('negativeRatio 1 → 1.0', () => {
    expect(saturationFromIntensity(1, 0.5)).toBeCloseTo(1.0, 5)
  })

  it('flatAffect 0 → 1.0 (반대축)', () => {
    expect(saturationFromIntensity(0, 0)).toBeCloseTo(1.0, 5)
  })

  it('두 축 중 더 강한 게 채택', () => {
    // negativeRatio 0.4, flat 0.2 → max(0.4, 0.8) = 0.8 → 0.3 + 0.7×0.8 = 0.86
    expect(saturationFromIntensity(0.4, 0.2)).toBeCloseTo(0.86, 2)
  })

  it('clamp 0~1', () => {
    expect(saturationFromIntensity(-0.5, 2)).toBeCloseTo(0.3, 5)
    expect(saturationFromIntensity(2, -1)).toBeCloseTo(1.0, 5)
  })
})

describe('motionFromFrequency', () => {
  it('0일 → 0.3', () => {
    expect(motionFromFrequency(0)).toBeCloseTo(0.3, 5)
  })

  it('7일 → 1.0', () => {
    expect(motionFromFrequency(7)).toBeCloseTo(1.0, 5)
  })

  it('3일 → 약 0.77 (로그 곡선)', () => {
    const v = motionFromFrequency(3)
    expect(v).toBeGreaterThan(0.74)
    expect(v).toBeLessThan(0.8)
  })

  it('clamp 0~7', () => {
    expect(motionFromFrequency(-1)).toBeCloseTo(0.3, 5)
    expect(motionFromFrequency(15)).toBeCloseTo(1.0, 5)
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/lib/orbAxes.test.ts
```

- [ ] **Step 3: 구현 작성**

```ts
// lib/orbAxes.ts
import type { Emotion, EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'

const HUE_COLORS: Record<Emotion, [number, number, number]> = {
  happy: [242, 201, 76],
  calm: [107, 171, 154],
  sad: [123, 163, 196],
  angry: [232, 128, 106],
}

const NEUTRAL_HUE = 'rgb(107,171,154)'

export function opacityFromCount(count: number): number {
  if (count <= 0) return 0.15
  return Math.min(1, 0.15 + 0.85 * (Math.log(count + 1) / Math.log(31)))
}

export function hueFromWeeklyEmotion(emotions: EmotionResult): string {
  const total = emotions.happy + emotions.calm + emotions.sad + emotions.angry
  if (total <= 0) return NEUTRAL_HUE
  let r = 0
  let g = 0
  let b = 0
  for (const key of ['happy', 'calm', 'sad', 'angry'] as const) {
    const w = emotions[key] / total
    const [cr, cg, cb] = HUE_COLORS[key]
    r += cr * w
    g += cg * w
    b += cb * w
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

export function saturationFromIntensity(
  negativeRatio: number,
  flatAffectAvg: number,
): number {
  const intensity = Math.max(
    0,
    Math.min(1, Math.max(negativeRatio, 1 - flatAffectAvg)),
  )
  return 0.3 + 0.7 * intensity
}

export function motionFromFrequency(daysOutOfSeven: number): number {
  const clamped = Math.max(0, Math.min(7, daysOutOfSeven))
  return 0.3 + 0.7 * (Math.log(clamped + 1) / Math.log(8))
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/lib/orbAxes.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add lib/orbAxes.ts tests/lib/orbAxes.test.ts
git commit -m "feat: lib/orbAxes — opacity/hue/saturation/motion 4축 매핑 TDD"
```

---

## Task 3: `lib/weeklyEmotion.ts` — 7일 집계 (TDD)

**Files:**
- Create: `lib/weeklyEmotion.ts`
- Create: `tests/lib/weeklyEmotion.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/lib/weeklyEmotion.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateWeeklyEmotion } from '@/lib/weeklyEmotion'
import type { EmotionRecord } from '@/shared/storage/db'

function rec(
  partial: Partial<EmotionRecord> & { id: number; timestamp: Date; duration: number },
): EmotionRecord {
  return {
    id: partial.id,
    timestamp: partial.timestamp,
    duration: partial.duration,
    detectionRate: partial.detectionRate ?? 1,
    happy: partial.happy ?? 0,
    calm: partial.calm ?? 1,
    sad: partial.sad ?? 0,
    angry: partial.angry ?? 0,
    dominantEmotion: partial.dominantEmotion ?? 'calm',
    flatAffectScore: partial.flatAffectScore ?? 0.5,
  }
}

const DAY = 24 * 60 * 60 * 1000

describe('aggregateWeeklyEmotion', () => {
  it('빈 records → null', () => {
    expect(aggregateWeeklyEmotion([], new Date('2026-04-28T12:00:00Z'))).toBeNull()
  })

  it('7일 밖 record만 있으면 null', () => {
    const end = new Date('2026-04-28T12:00:00Z')
    const old = rec({
      id: 1,
      timestamp: new Date(end.getTime() - 10 * DAY),
      duration: 60000,
    })
    expect(aggregateWeeklyEmotion([old], end)).toBeNull()
  })

  it('단일 record duration 가중 평균', () => {
    const end = new Date('2026-04-28T12:00:00Z')
    const r = rec({
      id: 1,
      timestamp: new Date(end.getTime() - DAY),
      duration: 60000,
      happy: 0.7,
      calm: 0.2,
      sad: 0.05,
      angry: 0.05,
      flatAffectScore: 0.4,
    })
    const result = aggregateWeeklyEmotion([r], end)
    expect(result).not.toBeNull()
    expect(result!.emotions.happy).toBeCloseTo(0.7, 5)
    expect(result!.emotions.calm).toBeCloseTo(0.2, 5)
    expect(result!.recordCount).toBe(1)
    expect(result!.daysOutOfSeven).toBe(1)
  })

  it('duration 가중 — 긴 record가 더 영향력', () => {
    const end = new Date('2026-04-28T12:00:00Z')
    const records = [
      rec({
        id: 1,
        timestamp: new Date(end.getTime() - 2 * DAY),
        duration: 10000, // 10초
        happy: 1,
        calm: 0,
      }),
      rec({
        id: 2,
        timestamp: new Date(end.getTime() - 1 * DAY),
        duration: 90000, // 90초
        happy: 0,
        calm: 1,
      }),
    ]
    const result = aggregateWeeklyEmotion(records, end)
    // 가중: (1*10 + 0*90)/100 = 0.1, (0*10 + 1*90)/100 = 0.9
    expect(result!.emotions.happy).toBeCloseTo(0.1, 2)
    expect(result!.emotions.calm).toBeCloseTo(0.9, 2)
  })

  it('daysOutOfSeven — 같은 날 여러 record는 1일로 카운트', () => {
    const end = new Date('2026-04-28T20:00:00Z')
    const records = [
      rec({ id: 1, timestamp: new Date('2026-04-28T08:00:00Z'), duration: 60000 }),
      rec({ id: 2, timestamp: new Date('2026-04-28T14:00:00Z'), duration: 60000 }),
      rec({ id: 3, timestamp: new Date('2026-04-27T12:00:00Z'), duration: 60000 }),
    ]
    const result = aggregateWeeklyEmotion(records, end)
    expect(result!.daysOutOfSeven).toBe(2)
  })

  it('daysOutOfSeven 최대 7', () => {
    const end = new Date('2026-04-28T12:00:00Z')
    const records = Array.from({ length: 7 }, (_, i) =>
      rec({
        id: i + 1,
        timestamp: new Date(end.getTime() - i * DAY),
        duration: 60000,
      }),
    )
    expect(aggregateWeeklyEmotion(records, end)!.daysOutOfSeven).toBe(7)
  })

  it('negativeRatio = sad + angry × 1.5 (riskCalculator와 일관)', () => {
    const end = new Date('2026-04-28T12:00:00Z')
    const r = rec({
      id: 1,
      timestamp: new Date(end.getTime() - DAY),
      duration: 60000,
      happy: 0.2,
      calm: 0.4,
      sad: 0.2,
      angry: 0.2,
      flatAffectScore: 0.7,
    })
    const result = aggregateWeeklyEmotion([r], end)
    // negative = 0.2 + 0.2 * 1.5 = 0.5
    expect(result!.negativeRatio).toBeCloseTo(0.5, 5)
    expect(result!.flatAffectAvg).toBeCloseTo(0.7, 5)
  })

  it('duration 0 record는 무시 (분모 0 방지)', () => {
    const end = new Date('2026-04-28T12:00:00Z')
    const records = [
      rec({ id: 1, timestamp: new Date(end.getTime() - DAY), duration: 0 }),
    ]
    expect(aggregateWeeklyEmotion(records, end)).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/lib/weeklyEmotion.test.ts
```

- [ ] **Step 3: 구현 작성**

```ts
// lib/weeklyEmotion.ts
import type { EmotionRecord } from '@/shared/storage/db'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { ANGRY_WEIGHT } from '@/features/algorithm/stress/riskCalculator'

export interface WeeklyEmotionAggregate {
  emotions: EmotionResult
  recordCount: number
  daysOutOfSeven: number
  negativeRatio: number
  flatAffectAvg: number
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function aggregateWeeklyEmotion(
  records: EmotionRecord[],
  endDate: Date,
): WeeklyEmotionAggregate | null {
  const startTs = endDate.getTime() - SEVEN_DAYS_MS
  const endTs = endDate.getTime()
  const inWindow = records.filter((r) => {
    const t = r.timestamp.getTime()
    return t >= startTs && t <= endTs && r.duration > 0
  })
  if (inWindow.length === 0) return null

  const totalDuration = inWindow.reduce((s, r) => s + r.duration, 0)
  if (totalDuration === 0) return null

  let happy = 0
  let calm = 0
  let sad = 0
  let angry = 0
  let neg = 0
  let flat = 0
  const dateSet = new Set<string>()

  for (const r of inWindow) {
    const w = r.duration
    happy += r.happy * w
    calm += r.calm * w
    sad += r.sad * w
    angry += r.angry * w
    neg += (r.sad + r.angry * ANGRY_WEIGHT) * w
    flat += r.flatAffectScore * w
    dateSet.add(r.timestamp.toISOString().slice(0, 10))
  }

  return {
    emotions: {
      happy: happy / totalDuration,
      calm: calm / totalDuration,
      sad: sad / totalDuration,
      angry: angry / totalDuration,
    },
    recordCount: inWindow.length,
    daysOutOfSeven: Math.min(7, dateSet.size),
    negativeRatio: neg / totalDuration,
    flatAffectAvg: flat / totalDuration,
  }
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/lib/weeklyEmotion.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add lib/weeklyEmotion.ts tests/lib/weeklyEmotion.test.ts
git commit -m "feat: lib/weeklyEmotion — 7일 record 집계 (duration 가중) TDD"
```

---

## Task 4: `app/globals.css` — 테마 토큰 + CSS Variables + @keyframes

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: 현재 상태 백업 (참고용)**

```bash
cp app/globals.css /tmp/globals.css.bak
```

- [ ] **Step 2: globals.css 전체 교체**

다음 내용으로 교체:

```css
@import "tailwindcss";
@import "pretendard/dist/web/variable/pretendardvariable.css";

:root {
  --background: #ffffff;
  --foreground: #171717;
  --font-sans: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', sans-serif;
}

/* ==========================================================
   THEME — data-theme 속성으로 다크/라이트 분기
   layout.tsx 의 인라인 스크립트가 SSR/하이드레이션 직전 적용.
   ========================================================== */

:root[data-theme="light"] {
  --bg-base: #FAFAFA;
  --bg-elev: #FFFFFF;
  --bg-tint: rgba(107, 171, 154, 0.05);
  --fg: #171717;
  --fg-muted: #737373;
  --fg-faint: #A3A3A3;
  --border: #E5E5E5;
  --accent: #6BAB9A;
  --caution: #D4A84B;
  --warning: #E8806A;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

:root[data-theme="dark"] {
  --bg-base: #050503;
  --bg-elev: #0E0E0B;
  --bg-tint: rgba(107, 171, 154, 0.06);
  --fg: #F0EDE6;
  --fg-muted: rgba(240, 237, 230, 0.55);
  --fg-faint: rgba(240, 237, 230, 0.25);
  --border: rgba(255, 255, 255, 0.08);
  --accent: #6BAB9A;
  --caution: #D4A84B;
  --warning: #E8806A;
  --shadow: 0 0 0 1px rgba(255, 255, 255, 0.04);
}

/* 랜딩 페이지 다크 톤 강제 (테마 무관 다크 베이스 위에서 동작) */
[data-landing-dark="true"] {
  --bg-base: #050503;
  --fg: #F0EDE6;
  --fg-muted: rgba(240, 237, 230, 0.45);
  --fg-faint: rgba(240, 237, 230, 0.15);
  --border: rgba(255, 255, 255, 0.06);
}

/* ==========================================================
   Living Orb — 호스트가 4축을 CSS var로 흘려보냄
   ========================================================== */
:root {
  --orb-opacity: 0.15;
  --orb-hue: rgb(107, 171, 154);
  --orb-saturation: 0.3;
  --orb-motion: 0.3;
}

@keyframes orbBreathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}

/* ==========================================================
   Scroll reveal (기존 유지)
   ========================================================== */
.r {
  transition:
    opacity 0.85s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.85s cubic-bezier(0.4, 0, 0.2, 1);
}
html.js-reveal .r:not(.in) {
  opacity: 0;
  transform: translateY(28px);
}
.r.in {
  opacity: 1;
  transform: none;
}
.r.d1 { transition-delay: 0.08s; }
.r.d2 { transition-delay: 0.16s; }
.r.d3 { transition-delay: 0.26s; }
.r.d4 { transition-delay: 0.38s; }

/* 스크롤 힌트 펄스 (Hero 하단) */
@keyframes scrollPulse {
  0%, 100% {
    opacity: 0.3;
    transform: scaleY(0.4);
    transform-origin: top;
  }
  50% {
    opacity: 1;
    transform: scaleY(1);
  }
}
.animate-scrollPulse {
  animation: scrollPulse 2.2s ease-in-out infinite;
  transform-origin: top;
}

/* 모션 민감 사용자 — 모든 애니메이션 정지 */
@media (prefers-reduced-motion: reduce) {
  .animate-scrollPulse,
  svg[role="img"][data-orb] {
    animation: none !important;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);

  --color-risk-good: #6BAB9A;
  --color-risk-caution: #D4A84B;
  --color-risk-warning: #E8806A;

  --color-ink-50: #FAFAFA;
  --color-ink-100: #F5F5F5;
  --color-ink-200: #E5E5E5;
  --color-ink-300: #D4D4D4;
  --color-ink-400: #A3A3A3;
  --color-ink-500: #737373;
  --color-ink-600: #525252;
  --color-ink-700: #404040;
  --color-ink-800: #262626;
  --color-ink-900: #171717;
}

body {
  background: var(--bg-base, var(--background));
  color: var(--fg, var(--foreground));
  font-family: var(--font-sans);
}
```

- [ ] **Step 3: dev 서버로 시각 회귀 점검**

```bash
npm run build 2>&1 | tail -20
```

Expected: build 성공, CSS 컴파일 에러 없음. 만약 에러 나면 `@theme inline` 블록 문법 확인.

- [ ] **Step 4: 커밋**

```bash
git add app/globals.css
git commit -m "feat: globals.css — data-theme 토큰 + Living Orb CSS vars + reduced-motion"
```

---

## Task 5: `hooks/useTheme.ts` (TDD)

**Files:**
- Create: `hooks/useTheme.ts`
- Create: `tests/hooks/useTheme.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/hooks/useTheme.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme, resolveAuto } from '@/hooks/useTheme'

describe('resolveAuto', () => {
  it('06:00 → light', () => {
    expect(resolveAuto(new Date('2026-04-28T06:00:00'))).toBe('light')
  })
  it('17:59 → light', () => {
    expect(resolveAuto(new Date('2026-04-28T17:59:00'))).toBe('light')
  })
  it('18:00 → dark', () => {
    expect(resolveAuto(new Date('2026-04-28T18:00:00'))).toBe('dark')
  })
  it('05:59 → dark', () => {
    expect(resolveAuto(new Date('2026-04-28T05:59:00'))).toBe('dark')
  })
})

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('기본값은 auto', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('auto')
  })

  it('localStorage 에 저장된 dark 가 복원됨', () => {
    localStorage.setItem('onmaum_theme', 'dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('잘못된 localStorage 값은 무시', () => {
    localStorage.setItem('onmaum_theme', 'rainbow')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('auto')
  })

  it('setTheme 으로 명시 변경 + localStorage 저장', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('light'))
    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem('onmaum_theme')).toBe('light')
  })

  it('cycleTheme 순환: light → dark → auto → light', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('light'))
    act(() => result.current.cycleTheme())
    expect(result.current.theme).toBe('dark')
    act(() => result.current.cycleTheme())
    expect(result.current.theme).toBe('auto')
    act(() => result.current.cycleTheme())
    expect(result.current.theme).toBe('light')
  })

  it('resolvedTheme 이 html.dataset.theme 에 반영', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('auto 모드는 현재 시간으로 분기', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T12:00:00'))
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('auto'))
    expect(result.current.resolvedTheme).toBe('light')
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/hooks/useTheme.test.ts
```

- [ ] **Step 3: 구현 작성**

```ts
// hooks/useTheme.ts
'use client'

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'onmaum_theme'
const VALID_THEMES: Theme[] = ['light', 'dark', 'auto']
const CYCLE: Theme[] = ['light', 'dark', 'auto']

export function resolveAuto(date: Date = new Date()): ResolvedTheme {
  const h = date.getHours()
  return h >= 6 && h < 18 ? 'light' : 'dark'
}

function readStored(): Theme {
  if (typeof window === 'undefined') return 'auto'
  try {
    const v = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (v && VALID_THEMES.includes(v)) return v
  } catch {}
  return 'auto'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStored)

  const resolvedTheme: ResolvedTheme =
    theme === 'auto' ? resolveAuto() : theme

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = resolvedTheme
    }
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }, [])

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = CYCLE[(CYCLE.indexOf(prev) + 1) % CYCLE.length]
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {}
      return next
    })
  }, [])

  return { theme, resolvedTheme, setTheme, cycleTheme }
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/hooks/useTheme.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add hooks/useTheme.ts tests/hooks/useTheme.test.ts
git commit -m "feat: useTheme hook — light/dark/auto + localStorage TDD"
```

---

## Task 6: `components/ThemeProvider.tsx`

**Files:**
- Create: `components/ThemeProvider.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// components/ThemeProvider.tsx
'use client'

import { createContext, useContext } from 'react'
import { useTheme, type Theme, type ResolvedTheme } from '@/hooks/useTheme'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme(next: Theme): void
  cycleTheme(): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useTheme()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemeContext must be used within <ThemeProvider>')
  }
  return ctx
}
```

- [ ] **Step 2: 빌드 검증**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add components/ThemeProvider.tsx
git commit -m "feat: ThemeProvider — useTheme Context wrapper"
```

---

## Task 7: `components/ThemeToggle.tsx` (TDD)

**Files:**
- Create: `components/ThemeToggle.tsx`
- Create: `tests/components/ThemeToggle.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/components/ThemeToggle.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeToggle from '@/components/ThemeToggle'
import { ThemeProvider } from '@/components/ThemeProvider'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('aria-label 에 현재 테마 노출', () => {
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/auto|dark|light/),
    )
  })

  it('클릭 시 테마 순환', () => {
    renderToggle()
    const button = screen.getByRole('button')
    const initialLabel = button.getAttribute('aria-label')
    fireEvent.click(button)
    expect(button.getAttribute('aria-label')).not.toBe(initialLabel)
  })

  it('3번 클릭하면 원래 테마로 복귀 (light→dark→auto→light 순환)', () => {
    localStorage.setItem('onmaum_theme', 'light')
    renderToggle()
    const button = screen.getByRole('button')
    const start = button.getAttribute('aria-label')
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button.getAttribute('aria-label')).toBe(start)
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/components/ThemeToggle.test.tsx
```

- [ ] **Step 3: 구현 작성**

```tsx
// components/ThemeToggle.tsx
'use client'

import { useThemeContext } from './ThemeProvider'
import type { Theme } from '@/hooks/useTheme'

const ICON: Record<Theme, string> = {
  light: '☀',
  dark: '☾',
  auto: '◐',
}

const NEXT_LABEL: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'auto',
  auto: 'light',
}

interface Props {
  className?: string
}

export default function ThemeToggle({ className }: Props) {
  const { theme, cycleTheme } = useThemeContext()
  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`테마 전환: 현재 ${theme}, 클릭하면 ${NEXT_LABEL[theme]}`}
      className={
        className ??
        'inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]'
      }
    >
      <span aria-hidden="true">{ICON[theme]}</span>
    </button>
  )
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/components/ThemeToggle.test.tsx
```

- [ ] **Step 5: 커밋**

```bash
git add components/ThemeToggle.tsx tests/components/ThemeToggle.test.tsx
git commit -m "feat: ThemeToggle — 3-mode 순환 버튼 TDD"
```

---

## Task 8: `hooks/useLivingOrb.ts` (TDD)

**Files:**
- Create: `hooks/useLivingOrb.ts`
- Create: `tests/hooks/useLivingOrb.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`useLiveQuery` 를 사용하므로 fake-indexeddb + db에 직접 record 삽입 후 검증.

```tsx
// tests/hooks/useLivingOrb.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLivingOrb } from '@/hooks/useLivingOrb'
import { db } from '@/shared/storage/db'
import type { EmotionRecord } from '@/shared/storage/db'

function rec(partial: Partial<EmotionRecord> & { timestamp: Date; duration: number }): Omit<EmotionRecord, 'id'> {
  return {
    timestamp: partial.timestamp,
    duration: partial.duration,
    detectionRate: partial.detectionRate ?? 1,
    happy: partial.happy ?? 0,
    calm: partial.calm ?? 1,
    sad: partial.sad ?? 0,
    angry: partial.angry ?? 0,
    dominantEmotion: partial.dominantEmotion ?? 'calm',
    flatAffectScore: partial.flatAffectScore ?? 0.5,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('useLivingOrb', () => {
  it('records 비어있으면 idle fallback + Empty', async () => {
    const { result } = renderHook(() => useLivingOrb())
    await waitFor(() => {
      expect(result.current.fallback).toBe('idle')
      expect(result.current.stage).toBe('empty')
    })
  })

  it('record 5개 → forming 단계 + opacity > 0.5', async () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      await db.emotions.add(
        rec({
          timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
          duration: 60000,
        }) as EmotionRecord,
      )
    }
    const { result } = renderHook(() => useLivingOrb())
    await waitFor(() => {
      expect(result.current.stage).toBe('forming')
      expect(result.current.axes.opacity).toBeGreaterThan(0.5)
      expect(result.current.fallback).toBeNull()
    })
  })

  it('마지막 record 가 2주 이상 지났으면 inactive2w + opacity × 0.5', async () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await db.emotions.add(
      rec({ timestamp: longAgo, duration: 60000 }) as EmotionRecord,
    )
    const { result } = renderHook(() => useLivingOrb())
    await waitFor(() => {
      expect(result.current.fallback).toBe('inactive2w')
      // 1 record → opacity ≈ 0.32, × 0.5 ≈ 0.16
      expect(result.current.axes.opacity).toBeLessThan(0.2)
    })
  })

  it('active=true + liveEmotion 있으면 hue 가 live emotion 반영', async () => {
    const now = Date.now()
    await db.emotions.add(
      rec({
        timestamp: new Date(now - 24 * 60 * 60 * 1000),
        duration: 60000,
        calm: 1,
      }) as EmotionRecord,
    )
    const { result } = renderHook(() =>
      useLivingOrb({
        active: true,
        liveEmotion: { happy: 1, calm: 0, sad: 0, angry: 0 },
      }),
    )
    await waitFor(() => {
      expect(result.current.axes.hue).toBe('rgb(242,201,76)')
    })
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/hooks/useLivingOrb.test.tsx
```

- [ ] **Step 3: 구현 작성**

```ts
// hooks/useLivingOrb.ts
'use client'

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/shared/storage/db'
import {
  hueFromWeeklyEmotion,
  motionFromFrequency,
  opacityFromCount,
  saturationFromIntensity,
} from '@/lib/orbAxes'
import { stageFromCount, type OrbStage } from '@/features/ui/orb/lib/orbStages'
import { aggregateWeeklyEmotion } from '@/lib/weeklyEmotion'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000
const NEUTRAL_HUE = 'rgb(107,171,154)'
const NEUTRAL_GRAY = 'rgb(163,163,163)'

export type OrbFallback = 'idle' | 'inactive2w' | 'error' | null

export interface OrbAxes {
  opacity: number
  hue: string
  saturation: number
  motion: number
}

export interface LivingOrbState {
  stage: OrbStage
  axes: OrbAxes
  fallback: OrbFallback
}

interface Options {
  liveEmotion?: EmotionResult | null
  active?: boolean
}

const NEUTRAL_AXES: OrbAxes = {
  opacity: 0.15,
  hue: NEUTRAL_HUE,
  saturation: 0.3,
  motion: 0.3,
}

const ERROR_AXES: OrbAxes = {
  opacity: 0.3,
  hue: NEUTRAL_GRAY,
  saturation: 0.3,
  motion: 0.3,
}

export function useLivingOrb(opts: Options = {}): LivingOrbState {
  const { liveEmotion = null, active = false } = opts

  const records = useLiveQuery(async () => {
    try {
      return await db.emotions.toArray()
    } catch (err) {
      console.error('Living Orb DB read failed:', err)
      return null
    }
  }, [])

  return useMemo<LivingOrbState>(() => {
    if (records === null) {
      return { stage: 'empty', axes: ERROR_AXES, fallback: 'error' }
    }
    if (records === undefined) {
      // 첫 마운트 직후 — 로딩 중
      return { stage: 'empty', axes: NEUTRAL_AXES, fallback: 'idle' }
    }
    if (records.length === 0) {
      return { stage: 'empty', axes: NEUTRAL_AXES, fallback: 'idle' }
    }

    const stage = stageFromCount(records.length)
    const now = new Date()
    const weekly = aggregateWeeklyEmotion(records, now)

    const lastRecord = records.reduce(
      (latest, r) =>
        r.timestamp.getTime() > latest.timestamp.getTime() ? r : latest,
      records[0],
    )
    const inactiveLong =
      now.getTime() - lastRecord.timestamp.getTime() > TWO_WEEKS_MS

    let opacity = opacityFromCount(records.length)
    if (inactiveLong) opacity *= 0.5

    let hue: string
    if (active && liveEmotion) {
      hue = hueFromWeeklyEmotion(liveEmotion)
    } else if (weekly) {
      hue = hueFromWeeklyEmotion(weekly.emotions)
    } else {
      hue = NEUTRAL_HUE
    }

    const saturation = weekly
      ? saturationFromIntensity(weekly.negativeRatio, weekly.flatAffectAvg)
      : 0.3

    const motion = weekly ? motionFromFrequency(weekly.daysOutOfSeven) : 0.3

    return {
      stage,
      axes: { opacity, hue, saturation, motion },
      fallback: inactiveLong ? 'inactive2w' : null,
    }
  }, [records, liveEmotion, active])
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/hooks/useLivingOrb.test.tsx
```

- [ ] **Step 5: 커밋**

```bash
git add hooks/useLivingOrb.ts tests/hooks/useLivingOrb.test.tsx
git commit -m "feat: useLivingOrb — DB+axes 조합 + idle/inactive2w/error fallback TDD"
```

---

## Task 9: `components/LivingOrb.tsx` (SVG, TDD)

**Files:**
- Create: `components/LivingOrb.tsx`
- Create: `tests/components/LivingOrb.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/components/LivingOrb.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import LivingOrb from '@/components/LivingOrb'

describe('LivingOrb', () => {
  it('Empty 단계는 stroke 만 (fill 없음)', () => {
    const { container } = render(
      <LivingOrb
        stage="empty"
        opacity={0.15}
        hue="rgb(107,171,154)"
        saturation={0.3}
        motion={0.3}
      />,
    )
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThan(0)
    const stroke = circles[0].getAttribute('stroke')
    expect(stroke).toContain('rgb')
    expect(circles[0].getAttribute('fill')).toBe('none')
  })

  it('Forming 단계는 fill 그라디언트 + blur 필터', () => {
    const { container } = render(
      <LivingOrb
        stage="forming"
        opacity={0.6}
        hue="rgb(107,171,154)"
        saturation={0.5}
        motion={0.5}
      />,
    )
    const fill = container.querySelector('circle')?.getAttribute('fill') ?? ''
    expect(fill).toContain('url(#')
    expect(container.querySelector('filter')).toBeTruthy()
  })

  it('Living 단계는 blur 필터 없음', () => {
    const { container } = render(
      <LivingOrb
        stage="living"
        opacity={1}
        hue="rgb(107,171,154)"
        saturation={1}
        motion={1}
      />,
    )
    expect(container.querySelector('filter')).toBeFalsy()
  })

  it('opacity prop 이 svg style 에 반영', () => {
    const { container } = render(
      <LivingOrb
        stage="settled"
        opacity={0.7}
        hue="rgb(107,171,154)"
        saturation={0.6}
        motion={0.6}
      />,
    )
    expect(container.querySelector('svg')?.getAttribute('style')).toContain(
      'opacity: 0.7',
    )
  })

  it('motion 이 높을수록 breathe duration 짧음', () => {
    const { container: low } = render(
      <LivingOrb
        stage="settled"
        opacity={0.7}
        hue="rgb(107,171,154)"
        saturation={0.6}
        motion={0.3}
      />,
    )
    const { container: high } = render(
      <LivingOrb
        stage="settled"
        opacity={0.7}
        hue="rgb(107,171,154)"
        saturation={0.6}
        motion={1}
      />,
    )
    const lowStyle = low.querySelector('svg')?.getAttribute('style') ?? ''
    const highStyle = high.querySelector('svg')?.getAttribute('style') ?? ''
    const lowDur = parseFloat(lowStyle.match(/orbBreathe (\d+\.?\d*)s/)?.[1] ?? '0')
    const highDur = parseFloat(highStyle.match(/orbBreathe (\d+\.?\d*)s/)?.[1] ?? '0')
    expect(highDur).toBeLessThan(lowDur)
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/components/LivingOrb.test.tsx
```

- [ ] **Step 3: 구현 작성**

```tsx
// components/LivingOrb.tsx
'use client'

import type { OrbStage } from '@/features/ui/orb/lib/orbStages'

interface Props {
  stage: OrbStage
  opacity: number
  hue: string
  saturation: number
  motion: number
  size?: number
  className?: string
}

const STAGE_BLUR_PX: Record<OrbStage, number> = {
  empty: 0,
  awakening: 1.6,
  forming: 1.0,
  settled: 0.4,
  living: 0,
}

let idCounter = 0

export default function LivingOrb({
  stage,
  opacity,
  hue,
  saturation,
  motion,
  size = 56,
  className,
}: Props) {
  const uid = `lo-${++idCounter}`
  const filterId = `${uid}-blur`
  const gradientId = `${uid}-grad`

  // motion 0.3~1 → breathe duration 5.2s ~ 2.5s
  const breathDuration = (5.2 - 2.7 * Math.max(0, Math.min(1, motion))).toFixed(2)
  const innerOpacity = 0.6 + 0.4 * Math.max(0, Math.min(1, saturation))
  const ringOpacity = 0.15 + 0.45 * Math.max(0, Math.min(1, saturation))
  const blurPx = STAGE_BLUR_PX[stage]

  const animation =
    stage === 'empty'
      ? 'none'
      : `orbBreathe ${breathDuration}s ease-in-out infinite`

  return (
    <svg
      role="img"
      data-orb={stage}
      aria-label={`Living Orb ${stage}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ opacity, animation }}
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity={innerOpacity} />
          <stop offset="45%" stopColor={hue} stopOpacity={innerOpacity * 0.7} />
          <stop offset="90%" stopColor={hue} stopOpacity={ringOpacity} />
          <stop offset="100%" stopColor={hue} stopOpacity="0" />
        </radialGradient>
        {blurPx > 0 && (
          <filter id={filterId}>
            <feGaussianBlur stdDeviation={blurPx} />
          </filter>
        )}
      </defs>
      {stage === 'empty' ? (
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={hue}
          strokeWidth="0.6"
          strokeOpacity="0.5"
        />
      ) : (
        <circle
          cx="50"
          cy="50"
          r="42"
          fill={`url(#${gradientId})`}
          filter={blurPx > 0 ? `url(#${filterId})` : undefined}
        />
      )}
    </svg>
  )
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/components/LivingOrb.test.tsx
```

- [ ] **Step 5: 커밋**

```bash
git add components/LivingOrb.tsx tests/components/LivingOrb.test.tsx
git commit -m "feat: LivingOrb SVG 컴포넌트 — 5단계 시각 + 4축 props TDD"
```

---

## Task 10: `LivingOrbProvider` + `LivingOrbHost` (Context + 우상단 호스트)

**Files:**
- Create: `components/LivingOrbProvider.tsx`
- Create: `components/LivingOrbHost.tsx`

- [ ] **Step 1: Provider 작성**

```tsx
// components/LivingOrbProvider.tsx
'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'

interface Value {
  liveEmotion: EmotionResult | null
  active: boolean
  setLive: (emotion: EmotionResult | null, active: boolean) => void
}

const LivingOrbContext = createContext<Value | null>(null)

export function LivingOrbProvider({ children }: { children: React.ReactNode }) {
  const [liveEmotion, setLiveEmotion] = useState<EmotionResult | null>(null)
  const [active, setActive] = useState(false)

  const setLive = useCallback(
    (emotion: EmotionResult | null, isActive: boolean) => {
      setLiveEmotion(emotion)
      setActive(isActive)
    },
    [],
  )

  return (
    <LivingOrbContext.Provider value={{ liveEmotion, active, setLive }}>
      {children}
    </LivingOrbContext.Provider>
  )
}

export function useLivingOrbInput(): Value {
  const ctx = useContext(LivingOrbContext)
  if (!ctx) {
    throw new Error('useLivingOrbInput must be used within <LivingOrbProvider>')
  }
  return ctx
}
```

- [ ] **Step 2: Host 작성**

```tsx
// components/LivingOrbHost.tsx
'use client'

import LivingOrb from './LivingOrb'
import { useLivingOrbInput } from './LivingOrbProvider'
import { useLivingOrb } from '@/hooks/useLivingOrb'

export default function LivingOrbHost() {
  const { liveEmotion, active } = useLivingOrbInput()
  const { stage, axes } = useLivingOrb({ liveEmotion, active })

  return (
    <div
      className="pointer-events-none fixed right-5 top-5 z-40 md:right-8 md:top-8"
      aria-hidden="false"
    >
      <LivingOrb
        stage={stage}
        opacity={axes.opacity}
        hue={axes.hue}
        saturation={axes.saturation}
        motion={axes.motion}
        size={56}
      />
    </div>
  )
}
```

- [ ] **Step 3: 빌드 검증**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 4: 커밋**

```bash
git add components/LivingOrbProvider.tsx components/LivingOrbHost.tsx
git commit -m "feat: LivingOrbProvider + LivingOrbHost — 우상단 fixed 호스트"
```

---

## Task 11: `hooks/useMilestone.ts` (TDD)

**Files:**
- Create: `hooks/useMilestone.ts`
- Create: `tests/hooks/useMilestone.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/hooks/useMilestone.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMilestone } from '@/hooks/useMilestone'

describe('useMilestone', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('초기값 empty → null (변화 없음)', () => {
    const { result } = renderHook(() => useMilestone('empty'))
    expect(result.current).toBeNull()
  })

  it('처음으로 awakening 도달 → event 발생', () => {
    const { result } = renderHook(() => useMilestone('awakening'))
    expect(result.current).not.toBeNull()
    expect(result.current!.stage).toBe('awakening')
  })

  it('이미 awakening 도달했으면 다시 마운트해도 event 없음', () => {
    localStorage.setItem('onmaum_orb_stage_max', 'awakening')
    const { result } = renderHook(() => useMilestone('awakening'))
    expect(result.current).toBeNull()
  })

  it('awakening → forming 상승 → event', () => {
    localStorage.setItem('onmaum_orb_stage_max', 'awakening')
    const { result } = renderHook(() => useMilestone('forming'))
    expect(result.current!.stage).toBe('forming')
  })

  it('상승 후 localStorage 갱신', () => {
    localStorage.setItem('onmaum_orb_stage_max', 'awakening')
    renderHook(() => useMilestone('forming'))
    expect(localStorage.getItem('onmaum_orb_stage_max')).toBe('forming')
  })

  it('하강은 event 안 발생 (forming → empty 같은 fallback)', () => {
    localStorage.setItem('onmaum_orb_stage_max', 'forming')
    const { result } = renderHook(() => useMilestone('empty'))
    expect(result.current).toBeNull()
    // localStorage 도 그대로 forming 유지
    expect(localStorage.getItem('onmaum_orb_stage_max')).toBe('forming')
  })

  it('잘못된 localStorage 값은 empty 로 간주', () => {
    localStorage.setItem('onmaum_orb_stage_max', 'banana')
    const { result } = renderHook(() => useMilestone('awakening'))
    expect(result.current).not.toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/hooks/useMilestone.test.ts
```

- [ ] **Step 3: 구현 작성**

```ts
// hooks/useMilestone.ts
'use client'

import { useEffect, useState } from 'react'
import { isStageHigher, STAGE_ORDER, type OrbStage } from '@/features/ui/orb/lib/orbStages'

const STORAGE_KEY = 'onmaum_orb_stage_max'

export interface MilestoneEvent {
  stage: OrbStage
  timestamp: number
}

function readMax(): OrbStage {
  if (typeof window === 'undefined') return 'empty'
  try {
    const v = localStorage.getItem(STORAGE_KEY) as OrbStage | null
    if (v && (STAGE_ORDER as readonly string[]).includes(v)) return v
  } catch {}
  return 'empty'
}

export function useMilestone(currentStage: OrbStage): MilestoneEvent | null {
  const [event, setEvent] = useState<MilestoneEvent | null>(null)

  useEffect(() => {
    const prevMax = readMax()
    if (isStageHigher(currentStage, prevMax)) {
      try {
        localStorage.setItem(STORAGE_KEY, currentStage)
      } catch {}
      setEvent({ stage: currentStage, timestamp: Date.now() })
    }
  }, [currentStage])

  return event
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/hooks/useMilestone.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add hooks/useMilestone.ts tests/hooks/useMilestone.test.ts
git commit -m "feat: useMilestone hook — stage 상승 감지 + localStorage TDD"
```

---

## Task 12: `components/MilestoneToast.tsx` (TDD)

**Files:**
- Create: `components/MilestoneToast.tsx`
- Create: `tests/components/MilestoneToast.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// tests/components/MilestoneToast.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import MilestoneToast from '@/components/MilestoneToast'
import { LivingOrbProvider } from '@/components/LivingOrbProvider'
import { db } from '@/shared/storage/db'
import type { EmotionRecord } from '@/shared/storage/db'

beforeEach(async () => {
  localStorage.clear()
  await db.delete()
  await db.open()
})

async function seedRecords(count: number) {
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    await db.emotions.add({
      timestamp: new Date(now - i * 24 * 60 * 60 * 1000),
      duration: 60000,
      detectionRate: 1,
      happy: 0,
      calm: 1,
      sad: 0,
      angry: 0,
      dominantEmotion: 'calm',
      flatAffectScore: 0.5,
    } as EmotionRecord)
  }
}

describe('MilestoneToast', () => {
  it('record 0개 → toast 안 보임', async () => {
    render(
      <LivingOrbProvider>
        <MilestoneToast />
      </LivingOrbProvider>,
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('record 5개 (forming 도달) + 처음이면 toast 등장', async () => {
    await seedRecords(5)
    render(
      <LivingOrbProvider>
        <MilestoneToast />
      </LivingOrbProvider>,
    )
    const toast = await screen.findByRole('status')
    expect(toast).toBeTruthy()
    expect(toast.textContent).toMatch(/forming|FORMING/i)
  })

  it('5초 후 자동 사라짐 (opacity 0)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await seedRecords(5)
    render(
      <LivingOrbProvider>
        <MilestoneToast />
      </LivingOrbProvider>,
    )
    const toast = await screen.findByRole('status')
    expect(toast.className).toContain('opacity-100')
    act(() => {
      vi.advanceTimersByTime(5100)
    })
    expect(toast.className).toContain('opacity-0')
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 예상**

```bash
npm run test:run -- tests/components/MilestoneToast.test.tsx
```

- [ ] **Step 3: 구현 작성**

```tsx
// components/MilestoneToast.tsx
'use client'

import { useEffect, useState } from 'react'
import { useLivingOrb } from '@/hooks/useLivingOrb'
import { useMilestone } from '@/hooks/useMilestone'
import { STAGE_MESSAGES } from '@/features/ui/orb/lib/orbStages'
import { useLivingOrbInput } from './LivingOrbProvider'

const FADE_MS = 5000

export default function MilestoneToast() {
  const { liveEmotion, active } = useLivingOrbInput()
  const { stage } = useLivingOrb({ liveEmotion, active })
  const event = useMilestone(stage)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!event) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), FADE_MS)
    // 옵트인 시 시스템 알림
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('온마음', {
          body: `당신의 구가 ${event.stage} 단계로 들어섰습니다`,
          icon: '/icon.svg',
        })
      } catch {}
    }
    return () => clearTimeout(t)
  }, [event])

  if (!event) return null

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setVisible(false)}
      className={`fixed bottom-6 right-6 z-50 max-w-xs cursor-pointer rounded-2xl border border-[var(--accent)]/30 bg-[var(--bg-elev,var(--bg-base))] px-5 py-4 shadow-lg transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
        — {event.stage.toUpperCase()}
      </div>
      <div className="text-[13px] font-light text-[var(--fg)]">
        {STAGE_MESSAGES[event.stage]}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- tests/components/MilestoneToast.test.tsx
```

- [ ] **Step 5: 커밋**

```bash
git add components/MilestoneToast.tsx tests/components/MilestoneToast.test.tsx
git commit -m "feat: MilestoneToast — 단계 전환 toast 5초 fade + 시스템 알림 옵트인"
```

---

## Task 13: `ReactiveOrb` 라이트 variant

**Files:**
- Modify: `features/ui/orb/ReactiveOrb.tsx`

- [ ] **Step 1: 현재 색 팔레트를 라이트/다크 두 벌로 분리**

`features/ui/orb/ReactiveOrb.tsx` 의 `drawBlob` 함수 내부 색 리터럴들을 다음 패턴으로 추출. 파일 상단(컴포넌트 바깥)에 팔레트 추가:

```ts
type Theme = 'light' | 'dark'

interface Palette {
  bgGlow: [string, string, string] // [inner, mid, outer]
  mainStops: Array<[number, (lx: number, ly: number) => string]>
  chrom: string
  rim: [string, string, string]
  glitter: (alpha: number) => string
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    bgGlow: ['rgba(107,171,154,0.09)', 'rgba(80,140,120,0.04)', 'transparent'],
    mainStops: [
      [0, (lx) => `rgba(${180 + lx * 30},${220 + lx * 20},210,0.92)`],
      [0.15, (lx) => `rgba(${140 + lx * 20},${190 + lx * 10},175,0.85)`],
      [0.35, (lx) => `rgba(${80 + lx * 15},${140 + lx * 8},128,0.78)`],
      [0.6, () => 'rgba(30,58,52,0.88)'],
      [0.82, () => 'rgba(10,22,18,0.94)'],
      [1, () => 'rgba(4,8,6,0.98)'],
    ],
    chrom: 'rgba(107,200,160,0.06)',
    rim: ['transparent', 'rgba(107,171,154,0.08)', 'rgba(107,171,154,0.22)'],
    glitter: (a) => `rgba(255,255,255,${0.12 + 0.1 * a})`,
  },
  light: {
    bgGlow: ['rgba(107,171,154,0.16)', 'rgba(80,140,120,0.08)', 'transparent'],
    mainStops: [
      [0, (lx) => `rgba(${250 - lx * 5},${252 - lx * 3},250,0.95)`],
      [0.15, (lx) => `rgba(${220 - lx * 8},${235 - lx * 6},225,0.88)`],
      [0.35, (lx) => `rgba(${170 + lx * 10},${210 + lx * 8},195,0.78)`],
      [0.6, () => 'rgba(130,180,165,0.55)'],
      [0.82, () => 'rgba(107,171,154,0.28)'],
      [1, () => 'rgba(107,171,154,0.05)'],
    ],
    chrom: 'rgba(80,140,120,0.05)',
    rim: ['transparent', 'rgba(80,140,120,0.1)', 'rgba(80,140,120,0.28)'],
    glitter: (a) => `rgba(80,140,120,${0.18 + 0.12 * a})`,
  },
}
```

그리고 `Props` 에 `theme?: Theme` 추가:

```ts
interface Props {
  className?: string
  theme?: Theme
}

export default function ReactiveOrb({ className, theme = 'dark' }: Props) {
  // ...
  const palette = PALETTES[theme]
  // ...
}
```

`drawBlob` 내부에서 색 리터럴을 모두 `palette.X` 로 교체:

```ts
// 배경 글로우
bgG.addColorStop(0, palette.bgGlow[0])
bgG.addColorStop(0.4, palette.bgGlow[1])
bgG.addColorStop(1, palette.bgGlow[2])

// 메인 그라디언트
for (const [offset, fn] of palette.mainStops) {
  mainG.addColorStop(offset, fn(lx, ly))
}

// 크로마틱
chromG.addColorStop(0, palette.chrom)
chromG.addColorStop(1, 'transparent')

// 림
rimG.addColorStop(0, palette.rim[0])
rimG.addColorStop(0.7, palette.rim[1])
rimG.addColorStop(1, palette.rim[2])

// 글리터
ctx.fillStyle = palette.glitter(Math.sin(t * 3 + i))
```

`useEffect` deps 에 `theme` 추가:

```ts
}, [theme])
```

- [ ] **Step 2: 빌드 검증**

```bash
npx tsc --noEmit 2>&1 | tail -10
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: 시각 회귀 (dev 서버)**

```bash
npm run dev &
```

브라우저 `http://localhost:3000`에서:
- `<ReactiveOrb theme="dark" />` (현재 기본) → 변화 없는지 확인
- `<ReactiveOrb theme="light" />` → 라이트 배경에 부드러운 청록 글로우 보이는지

(다음 Task에서 LandingHero 가 theme prop 전달하도록 수정)

- [ ] **Step 4: 커밋**

```bash
git add features/ui/orb/ReactiveOrb.tsx
git commit -m "feat: ReactiveOrb — light variant 팔레트 분기 (theme prop)"
```

---

## Task 14: `app/layout.tsx` 통합 (인라인 theme init + Provider 트리 + Host)

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: layout.tsx 전체 교체**

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import AppChrome from '@/features/ui/common/AppChrome'
import LivingOrbHost from '@/components/LivingOrbHost'
import { LivingOrbProvider } from '@/components/LivingOrbProvider'
import MilestoneToast from '@/components/MilestoneToast'
import ServiceWorkerRegistrar from '@/features/ui/common/ServiceWorkerRegistrar'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: '온마음',
  description: '얼굴 표정 기반 일별 마음 상태 모니터링',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '온마음',
  },
}

export const viewport: Viewport = {
  themeColor: '#6BAB9A',
  width: 'device-width',
  initialScale: 1,
}

const themeInitScript = `
(function(){
  try {
    var saved = localStorage.getItem('onmaum_theme') || 'auto';
    var resolved = saved;
    if (saved === 'auto') {
      var h = new Date().getHours();
      resolved = (h >= 6 && h < 18) ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = resolved;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`.trim()

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-[var(--bg-base)] text-[var(--fg)]">
        <ThemeProvider>
          <LivingOrbProvider>
            <AppChrome>{children}</AppChrome>
            <LivingOrbHost />
            <MilestoneToast />
          </LivingOrbProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 기존 테스트 회귀 점검**

```bash
npm run test:run
```

Expected: 기존 75 passing 유지 + 새 테스트들도 포함되어 더 많이 PASS.

- [ ] **Step 3: dev 서버로 시각 점검**

```bash
npm run dev &
```

`http://localhost:3000`:
- 우상단에 작은 Living Orb 보이는지 (Empty 단계 — 윤곽선만 희미)
- 페이지 전환(/, /measure, /stats) 시 Orb 위치 유지
- 첫 로드 시 깜빡임 없는지

- [ ] **Step 4: 커밋**

```bash
git add app/layout.tsx
git commit -m "feat: layout.tsx — 인라인 theme init + Provider + LivingOrbHost + MilestoneToast"
```

---

## Task 15: Navigation + LandingNav 톤 통일 + ThemeToggle

**Files:**
- Modify: `features/ui/common/Navigation.tsx`
- Modify: `features/ui/landing/LandingNav.tsx`

- [ ] **Step 1: Navigation 교체**

```tsx
// features/ui/common/Navigation.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

const TABS = [
  { href: '/measure', label: '측정' },
  { href: '/stats', label: '통계' },
] as const

export default function Navigation() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg-base)]">
      <div className="mx-auto flex w-full max-w-md items-center">
        <div className="flex flex-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 py-4 text-center text-[12px] font-light uppercase tracking-[0.16em] transition-colors ${
                  active
                    ? 'border-b border-[var(--accent)] text-[var(--fg)]'
                    : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                }`}
              >
                — {tab.label}
              </Link>
            )
          })}
        </div>
        <div className="px-3">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: LandingNav 라이트 모드 색 추가 + ThemeToggle**

`features/ui/landing/LandingNav.tsx` 에서 하드코딩된 색을 CSS var 또는 라이트/다크 분기로 교체. 다음으로 전체 교체:

```tsx
// features/ui/landing/LandingNav.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'

const NAV_LINKS = [
  { href: '#features', label: '기능' },
  { href: '#data', label: '데이터' },
  { href: '#risk', label: '위험도' },
] as const

interface Props {
  /** 랜딩이 강제 다크인지 여부. 기본 false (테마 따름) */
  forceDark?: boolean
}

export default function LandingNav({ forceDark = true }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 랜딩은 다크 모드 베이스가 정체성이라 forceDark=true 기본
  const fgClass = forceDark
    ? 'text-[rgba(240,237,230,0.65)]'
    : 'text-[var(--fg)]'
  const fgMuted = forceDark
    ? 'text-[rgba(240,237,230,0.38)]'
    : 'text-[var(--fg-muted)]'
  const navBg = forceDark
    ? scrolled
      ? 'border-b border-white/[0.06] bg-[rgba(5,5,3,0.75)] backdrop-blur-[20px]'
      : ''
    : scrolled
      ? 'border-b border-[var(--border)] bg-[var(--bg-base)]/80 backdrop-blur-[20px]'
      : ''

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-[52px] py-[26px] transition-all duration-400 ${navBg}`}
    >
      <div className="flex items-center gap-[10px]">
        <span
          aria-hidden="true"
          className="inline-block h-[22px] w-[22px] rounded-full bg-gradient-to-br from-[#6BAB9A] to-[#4E9080] shadow-[0_0_24px_rgba(107,171,154,0.4)]"
        />
        <span
          className={`text-[13px] font-light uppercase tracking-[0.14em] ${fgClass}`}
        >
          온마음
        </span>
      </div>

      <div
        className={`hidden items-center gap-9 text-[11px] font-light uppercase tracking-[0.1em] md:flex ${fgMuted}`}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-[#F0EDE6]"
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link
          href="/measure"
          className="rounded-full border border-[rgba(107,171,154,0.3)] px-6 py-[9px] text-[11px] font-normal uppercase tracking-[0.1em] text-[rgba(107,171,154,0.85)] transition-all hover:border-[#6BAB9A] hover:bg-[rgba(107,171,154,0.06)] hover:text-[#6BAB9A]"
        >
          앱 시작하기
        </Link>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: 빌드/테스트**

```bash
npx tsc --noEmit 2>&1 | tail -10
npm run test:run
```

- [ ] **Step 4: 커밋**

```bash
git add features/ui/common/Navigation.tsx features/ui/landing/LandingNav.tsx
git commit -m "feat: Navigation + LandingNav — 톤 통일 + ThemeToggle 통합"
```

---

## Task 16: Footer 톤 통일 (이모지 제거 + CSS var)

**Files:**
- Modify: `features/ui/common/ContactsFooter.tsx`
- Modify: `features/ui/landing/LandingFooter.tsx`

- [ ] **Step 1: ContactsFooter 교체**

```tsx
// features/ui/common/ContactsFooter.tsx
export default function ContactsFooter() {
  return (
    <footer className="mt-8 border-t border-[var(--border)] pb-2 pt-4 text-center text-[11px] font-light uppercase tracking-[0.12em] text-[var(--fg-muted)]">
      <p>
        <span className="opacity-60">정신건강 위기상담</span>{' '}
        <a
          href="tel:1577-0199"
          className="font-normal text-[var(--fg)] transition-colors hover:text-[var(--accent)]"
        >
          1577-0199
        </a>
        {' · '}
        <span className="opacity-60">자살예방</span>{' '}
        <a
          href="tel:1393"
          className="font-normal text-[var(--fg)] transition-colors hover:text-[var(--accent)]"
        >
          1393
        </a>
      </p>
    </footer>
  )
}
```

- [ ] **Step 2: LandingFooter 톤 유지 (랜딩은 다크 강제)**

`features/ui/landing/LandingFooter.tsx` 는 현재 다크 톤 그대로 유지. 변경 없이 패스 가능. (다크 베이스 위에서만 표시되므로 라이트 분기 필요 없음)

- [ ] **Step 3: 빌드 검증**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 4: 커밋**

```bash
git add features/ui/common/ContactsFooter.tsx
git commit -m "feat: ContactsFooter — 이모지 제거 + CSS var 톤 통일"
```

---

## Task 17: 페이지 헤더 라벨 패턴 + 이모지 제거 (measure, stats)

**Files:**
- Modify: `app/measure/page.tsx`
- Modify: `app/stats/page.tsx`

- [ ] **Step 1: measure/page.tsx 헤더/메시지 + LivingOrb 연결**

다음 변경:
1. 헤더에 라벨 패턴 적용: `— 측정`
2. font-semibold → font-thin
3. 상태 메시지 이모지(⏳/❌/✅) 제거
4. `useLivingOrbInput` 의 `setLive` 로 `currentEmotion` + `active` 흘려보내기

`app/measure/page.tsx` 의 다음 영역만 수정:

(a) import 추가:

```tsx
import { useLivingOrbInput } from '@/components/LivingOrbProvider'
```

(b) `Home` 컴포넌트 본체 시작에 useEffect 추가 (상태 hooks 다음):

```tsx
const { setLive } = useLivingOrbInput()
useEffect(() => {
  setLive(currentEmotion, active)
}, [currentEmotion, active, setLive])
```

(c) 컴포넌트 종료 시 cleanup 추가:

```tsx
useEffect(() => {
  return () => setLive(null, false)
}, [setLive])
```

(d) JSX 헤더 변경:

```tsx
<header className="text-center">
  <p className="mb-2 text-[10px] font-light uppercase tracking-[0.2em] text-[var(--accent)]">
    — 측정
  </p>
  <h1 className="text-3xl font-thin tracking-[-0.02em] text-[var(--fg)]">
    오늘의 마음 상태
  </h1>
  <p className="mt-2 text-[12px] font-light text-[var(--fg-muted)]">
    실시간 감정 분석
  </p>
</header>
```

(e) 상태 메시지 이모지 제거:

```tsx
{modelStatus === 'loading' && (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 text-center text-[12px] font-light text-[var(--fg-muted)]">
    모델을 불러오고 있습니다
  </div>
)}
{modelStatus === 'error' && (
  <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--bg-elev)] p-4 text-center text-[12px] font-light text-[var(--warning)]">
    모델을 불러오지 못했습니다 — {modelError}
  </div>
)}
{dbError && (
  <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--bg-elev)] p-4 text-center text-[12px] font-light text-[var(--warning)]">
    데이터 저장이 어려운 환경입니다 — {dbError}
  </div>
)}
{cameraError && (
  <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--bg-elev)] p-4 text-center text-[12px] font-light text-[var(--warning)]">
    카메라 오류 — {cameraError}
  </div>
)}
{saveError && (
  <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--bg-elev)] p-4 text-center text-[12px] font-light text-[var(--warning)]">
    저장 실패 — {saveError.message}
  </div>
)}
```

(f) 버튼 톤 통일:

```tsx
<div className="flex gap-3">
  <button
    type="button"
    onClick={handleStart}
    disabled={startDisabled}
    className="flex-1 rounded-full bg-[var(--accent)] px-6 py-3 text-[12px] font-normal uppercase tracking-[0.08em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
  >
    측정 시작
  </button>
  <button
    type="button"
    onClick={handleStop}
    disabled={!active}
    className="flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-elev)] px-6 py-3 text-[12px] font-normal uppercase tracking-[0.08em] text-[var(--fg)] transition-colors hover:bg-[var(--bg-tint)] disabled:cursor-not-allowed disabled:opacity-40"
  >
    측정 정지
  </button>
</div>
```

(g) `console.log('✅ ...')` 또는 `console.error('❌ ...')` 의 이모지 제거 (텍스트만 남기기).

- [ ] **Step 2: stats/page.tsx 헤더 교체**

`app/stats/page.tsx` 의 `<header>` 블록만 교체:

기존 (line 35~38):
```tsx
<header className="text-center">
  <h1 className="text-2xl font-semibold text-ink-900">통계</h1>
  <p className="mt-2 text-sm text-ink-500">오늘과 최근 기록</p>
</header>
```

변경 후:
```tsx
<header className="text-center">
  <p className="mb-2 text-[10px] font-light uppercase tracking-[0.2em] text-[var(--accent)]">
    — 통계
  </p>
  <h1 className="text-3xl font-thin tracking-[-0.02em] text-[var(--fg)]">
    이번 주의 마음
  </h1>
  <p className="mt-2 text-[12px] font-light text-[var(--fg-muted)]">
    오늘과 최근 기록
  </p>
</header>
```

(다른 영역은 그대로 유지 — `NotificationToggle`, `DailyRiskCard`, `TrendChart`, `SelfCareTip`, `RecentRecords` 는 Task 18에서 일괄 변경되므로 stats 페이지 자체는 헤더만 수정)

- [ ] **Step 3: 빌드/테스트 회귀**

```bash
npm run test:run
npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 4: 커밋**

```bash
git add app/measure/page.tsx app/stats/page.tsx
git commit -m "feat: page headers — 라벨 패턴 + 이모지 제거 + LivingOrb 연결"
```

---

## Task 18: 카드 컴포넌트 다크 톤 + 타이포 통일

**Files:**
- Modify: `features/ui/measure/EmotionDisplay.tsx`
- Modify: `components/DailyRiskCard.tsx`
- Modify: `features/ui/report/TrendChart.tsx`
- Modify: `features/ui/report/RecentRecords.tsx`
- Modify: `components/SelfCareTip.tsx`
- Modify: `components/NotificationToggle.tsx`
- 변경 없음: `components/RiskWarningModal.tsx` (위험 경고는 톤 유지가 의도 — spec §3 절제된 표현)

각 컴포넌트의 하드코딩된 `bg-white`, `border-ink-200`, `text-ink-*` 등을 CSS var로 교체.

- [ ] **Step 1: EmotionDisplay 교체**

```tsx
// features/ui/measure/EmotionDisplay.tsx
'use client'

import {
  EMOTION_LABELS,
  EMOTION_ORDER,
  getDominantEmotion,
  type Emotion,
  type EmotionResult,
} from '@/features/algorithm/emotion/emotionAnalysis'

const EMOTION_COLOR: Record<Emotion, string> = {
  happy: 'var(--accent)',
  calm: 'var(--fg)',
  sad: 'var(--caution)',
  angry: 'var(--warning)',
}

interface Props {
  emotion: EmotionResult | null
}

export default function EmotionDisplay({ emotion }: Props) {
  if (!emotion) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-center text-[12px] font-light text-[var(--fg-muted)]">
        얼굴이 감지되지 않습니다
      </div>
    )
  }

  const dominant = getDominantEmotion(emotion)
  const dominantPercent = Math.round(emotion[dominant] * 100)

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-6">
      <div className="text-center">
        <p className="text-[11px] font-light uppercase tracking-[0.18em] text-[var(--fg-muted)]">
          현재 감정
        </p>
        <p
          className="mt-2 text-4xl font-thin tracking-[-0.02em]"
          style={{ color: EMOTION_COLOR[dominant] }}
        >
          {EMOTION_LABELS[dominant]}
        </p>
        <p className="mt-1 text-[12px] font-light text-[var(--fg-muted)] tabular-nums">
          {dominantPercent}%
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {EMOTION_ORDER.map((key) => {
          const percent = Math.round(emotion[key] * 100)
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-[11px] font-light text-[var(--fg-muted)]">
                <span>{EMOTION_LABELS[key]}</span>
                <span className="tabular-nums">{percent}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bg-tint)]">
                <div
                  className="h-full transition-[width] duration-300"
                  style={{
                    width: `${percent}%`,
                    background: EMOTION_COLOR[key],
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 나머지 카드 컴포넌트들 — 같은 패턴 적용**

`DailyRiskCard.tsx`, `TrendChart.tsx`, `RecentRecords.tsx`, `SelfCareTip.tsx`, `NotificationToggle.tsx` 각 파일을 읽고 다음 매핑으로 일괄 교체:

| 기존 | 변경 |
|---|---|
| `bg-white` | `bg-[var(--bg-elev)]` |
| `border-ink-200` | `border-[var(--border)]` |
| `text-ink-900` | `text-[var(--fg)]` |
| `text-ink-700` | `text-[var(--fg)]` |
| `text-ink-600` | `text-[var(--fg-muted)]` |
| `text-ink-500` | `text-[var(--fg-muted)]` |
| `text-ink-400` | `text-[var(--fg-faint)]` |
| `bg-ink-100` | `bg-[var(--bg-tint)]` |
| `bg-risk-good` | `bg-[var(--accent)]` |
| `text-risk-good` | `text-[var(--accent)]` |
| `bg-risk-caution` | `bg-[var(--caution)]` |
| `text-risk-caution` | `text-[var(--caution)]` |
| `bg-risk-warning` | `bg-[var(--warning)]` |
| `text-risk-warning` | `text-[var(--warning)]` |
| `font-semibold`, `font-bold` | `font-thin` (헤딩) 또는 `font-light` (본문) |

각 파일을 Read → Edit 으로 변경.

- [ ] **Step 3: 회귀 테스트**

```bash
npm run test:run
```

기존 카드 관련 테스트 (DailyRiskCard 등) 통과 확인.

- [ ] **Step 4: dev 서버 시각 점검**

```bash
npm run dev &
```

`/measure`, `/stats`에서:
- 라이트/다크 토글 시 카드 색이 자연스럽게 따라오는지
- 텍스트 가독성 OK인지
- 위험 색(주황/노랑)이 두 모드에서 다 잘 보이는지

- [ ] **Step 5: 커밋**

```bash
git add features/ui/measure/EmotionDisplay.tsx components/DailyRiskCard.tsx features/ui/report/TrendChart.tsx features/ui/report/RecentRecords.tsx components/SelfCareTip.tsx components/NotificationToggle.tsx
git commit -m "feat: 카드 컴포넌트 6종 — CSS var 기반 다크/라이트 양쪽 지원 + 타이포 통일"
```

---

## Task 19: prefers-reduced-motion + 접근성 마무리

**Files:**
- Modify: `features/ui/orb/ReactiveOrb.tsx` (모션 정지)

- [ ] **Step 1: ReactiveOrb 에 prefers-reduced-motion 감지 추가**

`features/ui/orb/ReactiveOrb.tsx` 의 `useEffect` 시작 부분에:

```ts
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (reducedMotion) {
  // 정적 한 프레임만 그리고 종료
  resize()
  // 한 번만 render 호출
  drawBlob(canvas.width * 0.68, canvas.height * 0.5, Math.min(canvas.width, canvas.height) * 0.32, 0, 0, 0)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', resize)
    document.removeEventListener('mousemove', handleMouse)
  }
}
```

이미 `globals.css` 에 `svg[role="img"][data-orb]` 의 animation 정지 규칙은 추가됨.

- [ ] **Step 2: 빌드 검증**

```bash
npx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 3: 커밋**

```bash
git add features/ui/orb/ReactiveOrb.tsx
git commit -m "feat: ReactiveOrb — prefers-reduced-motion 감지 시 정적 한 프레임"
```

---

## Task 20: 통합 검증 + Living Orb 페이지 연결 점검

**Files:**
- Modify: `features/ui/landing/LandingHero.tsx` (ReactiveOrb theme prop 전달)

- [ ] **Step 1: LandingHero 가 ReactiveOrb 에 theme="dark" 명시 (랜딩은 강제 다크)**

`features/ui/landing/LandingHero.tsx`:

```tsx
<ReactiveOrb theme="dark" />
```

(기존 `<ReactiveOrb />` 를 위로 교체. 랜딩은 다크 베이스가 정체성이라 명시.)

- [ ] **Step 2: 전체 테스트 실행**

```bash
npm run test:run
```

Expected: **75 (기존) + 신규 테스트 모두 PASS**.

- [ ] **Step 3: dev 서버에서 골든 패스 검증**

```bash
npm run dev &
```

체크리스트 (`http://localhost:3000`):

1. **랜딩 (`/`)**: 
   - [ ] 우상단 Living Orb 보임 (현재 record가 0이면 Empty 윤곽선)
   - [ ] 중앙 ReactiveOrb 정상 동작 (마우스 따라옴)
   - [ ] LandingNav 우측에 ThemeToggle 보임
   - [ ] 다크 베이스 유지

2. **테마 토글 (☀ → ☾ → ◐ 순환)**:
   - [ ] ThemeToggle 클릭 시 페이지가 light↔dark 즉시 변환
   - [ ] 새로고침해도 마지막 선택 유지 (localStorage)
   - [ ] auto 모드면 시간대에 맞게 자동 분기

3. **`/measure`**:
   - [ ] 헤더에 `— 측정` 라벨 + font-thin "오늘의 마음 상태"
   - [ ] 이모지(⏳/❌/✅) 보이지 않음
   - [ ] 우상단 Living Orb 그대로 (랜딩에서 이동해도 위치 같음)
   - [ ] 측정 시작 → 우상단 Orb 색이 실시간 dominant 감정 따라 변하는지

4. **`/stats`**:
   - [ ] 헤더에 `— 통계` 라벨
   - [ ] 카드들 라이트/다크 양쪽에서 가독성 OK
   - [ ] Living Orb 위치 유지

5. **단계 전환 toast (테스트 환경)**:
   - [ ] localStorage 비우기 + record 5개 추가 시 forming 단계 toast 등장
   - [ ] 5초 후 자동 사라짐

6. **prefers-reduced-motion**:
   - [ ] OS 설정 → 동작 줄이기 ON 시 ReactiveOrb 정적
   - [ ] LivingOrb 호흡 애니메이션 정지

- [ ] **Step 4: 빌드 검증**

```bash
npm run build
```

Expected: 에러 없이 빌드 성공.

- [ ] **Step 5: 최종 커밋 + spec 참조**

```bash
git add features/ui/landing/LandingHero.tsx
git commit -m "feat: LandingHero — ReactiveOrb theme=dark 명시 + Living Orb 통합 검증"
```

- [ ] **Step 6: spec/plan 보존 커밋 (이미 있으면 skip)**

```bash
git status --short
# 만약 spec/plan 이 unstaged면:
git add docs/superpowers/specs/2026-04-28-living-orb-and-tone-design.md docs/superpowers/plans/2026-04-28-living-orb-and-tone.md
git commit -m "docs: Living Orb + 톤 통합 spec + plan"
```

---

## Self-Review Checklist (구현 완료 후)

- [ ] **모든 신규 테스트 PASS** (npm run test:run)
- [ ] **기존 75개 테스트 회귀 없음**
- [ ] **TypeScript 컴파일 에러 0개** (npx tsc --noEmit)
- [ ] **npm run build 성공**
- [ ] **dev 서버에서 골든 패스 4개 페이지(/, /measure, /stats) 시각 검증 완료**
- [ ] **테마 토글 3-mode 순환 + localStorage 영속 동작**
- [ ] **Living Orb 4축이 record 변화에 반응 (npm 측정 후 Orb 색·opacity 변화)**
- [ ] **단계 전환 toast 1회 발동 검증 (localStorage onmaum_orb_stage_max 확인)**
- [ ] **이모지 모두 제거 (⏳/❌/✅/📞)**
- [ ] **prefers-reduced-motion 적용 시 모든 모션 정지**

문제 발견 시: 해당 Task로 돌아가 fix 후 재검증.

---

## Out of Scope (다음 spec)

이 plan에서는 의도적으로 구현하지 않음:
- Reflection View (월말 타임랩스) — `/reflection` 페이지 또는 모달
- "지난주의 나 vs 지금의 나" 비교 컴포넌트
- 호흡 가이드 컴포넌트
- 익명 커뮤니티 / 감정노동 상담 안내 추가
- 주간/월간 패턴 시각화 강화 (TrendChart 재설계)
- Step 9 Vercel 배포

다음 spec/plan으로 분리.
