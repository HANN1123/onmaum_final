# 감정 오브 렌더 엔진 (P2) Implementation Plan

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스트레스 지수(P/N)·감정·누적량을 입력받아 오브의 색/성장/움직임/한 줄 카피로 매핑하는 순수 엔진을 TDD로 만들고, 이를 소비하는 "또렷(crisp)" 글래스+오로라 캔버스 컴포넌트를 구현한다.

**Architecture:** 순수 매핑 함수는 `lib/orb*.ts`에 책임별로 분리(성장/색/움직임/카피). 캔버스 렌더 컴포넌트는 이 함수들을 props로 소비. 색 기준값은 spec §5와 v1(`feature/living-orb-and-tone`)의 값이 동일해 재사용한다.

**Tech Stack:** TypeScript, Vitest(`@/` alias, happy-dom, globals, 한국어 테스트명), React(Canvas 2D). P1 엔진(`features/algorithm/stress/stressIndex.ts`)과 `EmotionResult`/`Emotion`(`features/algorithm/emotion/emotionAnalysis.ts`) 사용.

**Spec:** `docs/superpowers/specs/2026-06-08-onmaum-v2-orb-stress-design.md` §5(오브), §9(카피)

---

## File Structure

- `features/ui/orb/lib/orbStages.ts` (생성) — 성장 5단계 + 누적량→투명도. v1에서 포팅.
- `features/ui/orb/lib/orbColor.ts` (생성) — 감정 기준색, 상위2 그라데이션, 누적 "내 색" 블렌드.
- `features/ui/orb/lib/orbMotion.ts` (생성) — 감정별 숨결/움직임 파라미터.
- `features/ui/orb/lib/orbCaption.ts` (생성) — 토스 톤 한 줄 카피.
- `features/ui/orb/ReactiveOrb.tsx` (수정/교체) — 위 엔진을 소비하는 "또렷" 글래스+오로라 캔버스. (시각 검증)
- 테스트: `tests/ui/orb/lib/orbStages.test.ts`, `tests/ui/orb/lib/orbColor.test.ts`, `tests/ui/orb/lib/orbMotion.test.ts`, `tests/ui/orb/lib/orbCaption.test.ts`

후속(범위 밖): PiP 오버레이(P3), 온보딩·피드백·하이브리드 기준선(P4), 데모(P5).

---

## Task 1: 성장 5단계 + 투명도 (orbStages)

**Files:**
- Create: `features/ui/orb/lib/orbStages.ts`
- Test: `tests/ui/orb/lib/orbStages.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/ui/orb/lib/orbStages.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  STAGE_THRESHOLDS,
  STAGE_ORDER,
  STAGE_MESSAGES,
  stageFromCount,
  opacityFromCount,
} from '@/features/ui/orb/lib/orbStages'

describe('orbStages', () => {
  it('5단계 임계값', () => {
    expect(STAGE_THRESHOLDS).toEqual({ empty: 0, awakening: 1, forming: 4, settled: 11, living: 31 })
  })
  it('empty→living 순서', () => {
    expect(STAGE_ORDER).toEqual(['empty', 'awakening', 'forming', 'settled', 'living'])
  })
  it('단계별 한국어 메시지', () => {
    expect(STAGE_MESSAGES.empty).toBe('아직 당신을 모릅니다')
    expect(STAGE_MESSAGES.living).toBe('당신과 함께 살아갑니다')
  })
  it('누적량 → 단계', () => {
    expect(stageFromCount(0)).toBe('empty')
    expect(stageFromCount(1)).toBe('awakening')
    expect(stageFromCount(4)).toBe('forming')
    expect(stageFromCount(11)).toBe('settled')
    expect(stageFromCount(31)).toBe('living')
    expect(stageFromCount(-1)).toBe('empty')
  })
  it('누적량 → 투명도(로그)', () => {
    expect(opacityFromCount(0)).toBeCloseTo(0.15)
    expect(opacityFromCount(31)).toBeCloseTo(1.0)
    expect(opacityFromCount(9999)).toBe(1)
    expect(opacityFromCount(-5)).toBeCloseTo(0.15)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/ui/orb/lib/orbStages.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `features/ui/orb/lib/orbStages.ts`:
```ts
export type OrbStage = 'empty' | 'awakening' | 'forming' | 'settled' | 'living'

export const STAGE_THRESHOLDS = {
  empty: 0,
  awakening: 1,
  forming: 4,
  settled: 11,
  living: 31,
} as const satisfies Record<OrbStage, number>

export const STAGE_ORDER = ['empty', 'awakening', 'forming', 'settled', 'living'] as const satisfies readonly OrbStage[]

export const STAGE_MESSAGES = {
  empty: '아직 당신을 모릅니다',
  awakening: '조금씩 느껴지기 시작',
  forming: '당신의 결이 보이기 시작',
  settled: '당신의 결이 분명해집니다',
  living: '당신과 함께 살아갑니다',
} as const satisfies Record<OrbStage, string>

export function stageFromCount(count: number): OrbStage {
  if (count >= STAGE_THRESHOLDS.living) return 'living'
  if (count >= STAGE_THRESHOLDS.settled) return 'settled'
  if (count >= STAGE_THRESHOLDS.forming) return 'forming'
  if (count >= STAGE_THRESHOLDS.awakening) return 'awakening'
  return 'empty'
}

const OPACITY_FULL_COUNT = 31
const OPACITY_CURVE_DENOMINATOR = Math.log(36)

export function opacityFromCount(count: number): number {
  if (count <= 0) return 0.15
  if (count >= OPACITY_FULL_COUNT) return 1
  return 0.15 + 0.85 * (Math.log(count + 1) / OPACITY_CURVE_DENOMINATOR)
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/ui/orb/lib/orbStages.test.ts` → PASS
- [ ] **Step 5: 커밋**
```bash
git add features/ui/orb/lib/orbStages.ts tests/ui/orb/lib/orbStages.test.ts
git commit -m "feat(orbStages): 성장 5단계 + 누적량 투명도 (TDD)"
```

---

## Task 2: 감정 기준색 + 상위2 감정 (orbColor)

**Files:**
- Create: `features/ui/orb/lib/orbColor.ts`
- Test: `tests/ui/orb/lib/orbColor.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/ui/orb/lib/orbColor.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EMOTION_HUES, rgbString, topTwoEmotions } from '@/features/ui/orb/lib/orbColor'

describe('orbColor 기본', () => {
  it('감정 기준색 (spec §5)', () => {
    expect(EMOTION_HUES.happy).toEqual([242, 201, 76])
    expect(EMOTION_HUES.calm).toEqual([107, 171, 154])
    expect(EMOTION_HUES.sad).toEqual([123, 163, 196])
    expect(EMOTION_HUES.angry).toEqual([232, 128, 106])
  })
  it('rgbString', () => {
    expect(rgbString([1, 2, 3])).toBe('rgb(1,2,3)')
  })
  it('상위 2개 감정 (지배·차순)', () => {
    expect(topTwoEmotions({ happy: 0.6, calm: 0.1, sad: 0.1, angry: 0.2 })).toEqual(['happy', 'angry'])
    expect(topTwoEmotions({ happy: 0.1, calm: 0.1, sad: 0.5, angry: 0.3 })).toEqual(['sad', 'angry'])
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/ui/orb/lib/orbColor.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `features/ui/orb/lib/orbColor.ts`:
```ts
import type { Emotion, EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { EMOTION_ORDER } from '@/features/algorithm/emotion/emotionAnalysis'

export type RGB = readonly [number, number, number]

export const EMOTION_HUES: Record<Emotion, RGB> = {
  happy: [242, 201, 76],
  calm: [107, 171, 154],
  sad: [123, 163, 196],
  angry: [232, 128, 106],
}

export function rgbString(c: RGB): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export function topTwoEmotions(e: EmotionResult): [Emotion, Emotion] {
  const sorted = [...EMOTION_ORDER].sort((a, b) => e[b] - e[a])
  return [sorted[0], sorted[1]]
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/ui/orb/lib/orbColor.test.ts` → PASS
- [ ] **Step 5: 커밋**
```bash
git add features/ui/orb/lib/orbColor.ts tests/ui/orb/lib/orbColor.test.ts
git commit -m "feat(orbColor): 감정 기준색 + 상위2 감정 (TDD)"
```

---

## Task 3: 상위2 그라데이션 + 누적 "내 색" (orbColor)

**Files:**
- Modify: `features/ui/orb/lib/orbColor.ts`
- Test: `tests/ui/orb/lib/orbColor.test.ts` (추가)

- [ ] **Step 1: 실패 테스트 작성** (추가)
```ts
import { gradientColors, accumulatedColor } from '@/features/ui/orb/lib/orbColor'

describe('orbColor 혼합', () => {
  it('상위2 그라데이션 (from=지배, to=차순)', () => {
    const g = gradientColors({ happy: 0.6, calm: 0.1, sad: 0.1, angry: 0.2 })
    expect(g.from).toBe('rgb(242,201,76)') // happy
    expect(g.to).toBe('rgb(232,128,106)') // angry
  })
  it('누적 "내 색" — 단일 감정', () => {
    expect(accumulatedColor({ happy: 1, calm: 0, sad: 0, angry: 0 })).toBe('rgb(242,201,76)')
  })
  it('누적 "내 색" — 가중 블렌드', () => {
    expect(accumulatedColor({ happy: 0.5, calm: 0.5, sad: 0, angry: 0 })).toBe('rgb(175,186,115)')
  })
  it('누적 "내 색" — 전부 0이면 평온색 폴백', () => {
    expect(accumulatedColor({ happy: 0, calm: 0, sad: 0, angry: 0 })).toBe('rgb(107,171,154)')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/ui/orb/lib/orbColor.test.ts` → FAIL (`gradientColors`/`accumulatedColor` 없음)

- [ ] **Step 3: 구현** (추가) — `features/ui/orb/lib/orbColor.ts`:
```ts
export function gradientColors(e: EmotionResult): { from: string; to: string } {
  const [a, b] = topTwoEmotions(e)
  return { from: rgbString(EMOTION_HUES[a]), to: rgbString(EMOTION_HUES[b]) }
}

const EMOTIONS: Emotion[] = ['happy', 'calm', 'sad', 'angry']

export function accumulatedColor(emotions: EmotionResult): string {
  const total = EMOTIONS.reduce((sum, k) => sum + emotions[k], 0)
  if (total <= 0) return rgbString(EMOTION_HUES.calm)
  const blended = EMOTIONS.reduce(
    (acc, k) => {
      const w = emotions[k] / total
      const c = EMOTION_HUES[k]
      return [acc[0] + c[0] * w, acc[1] + c[1] * w, acc[2] + c[2] * w] as [number, number, number]
    },
    [0, 0, 0] as [number, number, number],
  ).map(Math.round) as unknown as RGB
  return rgbString(blended)
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/ui/orb/lib/orbColor.test.ts` → PASS
- [ ] **Step 5: 커밋**
```bash
git add features/ui/orb/lib/orbColor.ts tests/ui/orb/lib/orbColor.test.ts
git commit -m "feat(orbColor): 상위2 그라데이션 + 누적 내 색 블렌드 (TDD)"
```

---

## Task 4: 감정별 숨결/움직임 (orbMotion)

**Files:**
- Create: `features/ui/orb/lib/orbMotion.ts`
- Test: `tests/ui/orb/lib/orbMotion.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/ui/orb/lib/orbMotion.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { motionFor } from '@/features/ui/orb/lib/orbMotion'

describe('motionFor', () => {
  it('평온 = 느리고 깊은 숨, 부유 없음', () => {
    const m = motionFor('calm')
    expect(m.breathPeriodMs).toBe(5000)
    expect(m.floatY).toBe(0)
    expect(m.jitter).toBe(false)
  })
  it('기쁨 = 빠른 숨 + 위로 부유(floatY<0)', () => {
    const m = motionFor('happy')
    expect(m.breathPeriodMs).toBeLessThan(motionFor('calm').breathPeriodMs)
    expect(m.floatY).toBeLessThan(0)
  })
  it('슬픔 = 느리고 얕은 숨 + 가라앉음(floatY>0)', () => {
    const m = motionFor('sad')
    expect(m.breathPeriodMs).toBeGreaterThan(motionFor('calm').breathPeriodMs)
    expect(m.breathAmp).toBeLessThan(motionFor('calm').breathAmp)
    expect(m.floatY).toBeGreaterThan(0)
  })
  it('화남 = 빠른 숨, 단 떨림(jitter)은 없음', () => {
    const m = motionFor('angry')
    expect(m.breathPeriodMs).toBeLessThan(motionFor('calm').breathPeriodMs)
    expect(m.jitter).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/ui/orb/lib/orbMotion.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `features/ui/orb/lib/orbMotion.ts`:
```ts
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

export interface MotionParams {
  breathPeriodMs: number // 호흡 주기
  breathAmp: number // 호흡 진폭(반경 비율)
  floatY: number // 수직 이동(음수=위로 부유, 양수=가라앉음)
  jitter: boolean // 떨림 — 설계상 항상 false (떨림·번개 금지)
}

const MOTION: Record<Emotion, MotionParams> = {
  calm: { breathPeriodMs: 5000, breathAmp: 0.04, floatY: 0, jitter: false },
  happy: { breathPeriodMs: 3200, breathAmp: 0.05, floatY: -0.05, jitter: false },
  sad: { breathPeriodMs: 6500, breathAmp: 0.02, floatY: 0.06, jitter: false },
  angry: { breathPeriodMs: 4000, breathAmp: 0.05, floatY: 0, jitter: false },
}

export function motionFor(dominant: Emotion): MotionParams {
  return MOTION[dominant]
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/ui/orb/lib/orbMotion.test.ts` → PASS
- [ ] **Step 5: 커밋**
```bash
git add features/ui/orb/lib/orbMotion.ts tests/ui/orb/lib/orbMotion.test.ts
git commit -m "feat(orbMotion): 감정별 숨결/움직임 파라미터 (TDD)"
```

---

## Task 5: 토스 톤 한 줄 카피 (orbCaption)

**Files:**
- Create: `features/ui/orb/lib/orbCaption.ts`
- Test: `tests/ui/orb/lib/orbCaption.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/ui/orb/lib/orbCaption.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { EMOTION_CAPTIONS, captionFor } from '@/features/ui/orb/lib/orbCaption'

describe('orbCaption', () => {
  it('4감정 토스 톤 카피 (spec §9)', () => {
    expect(EMOTION_CAPTIONS.calm).toBe('마음이 잔잔해요 🌿')
    expect(EMOTION_CAPTIONS.happy).toBe('오늘 기분, 좋아 보여요 ☀️')
    expect(EMOTION_CAPTIONS.sad).toBe('오늘 좀 무거웠죠. 천천히 가요')
    expect(EMOTION_CAPTIONS.angry).toBe('마음에 힘이 들어갔네요. 잠깐 숨 돌릴까요?')
  })
  it('captionFor(지배 감정)', () => {
    expect(captionFor('happy')).toBe('오늘 기분, 좋아 보여요 ☀️')
  })
  it('단정 어휘를 쓰지 않는다(주어=마음, ~해요/~까요?)', () => {
    for (const c of Object.values(EMOTION_CAPTIONS)) {
      expect(c).not.toMatch(/당신은|불안합니다|화났습니다/)
    }
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/ui/orb/lib/orbCaption.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `features/ui/orb/lib/orbCaption.ts`:
```ts
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

export const EMOTION_CAPTIONS: Record<Emotion, string> = {
  calm: '마음이 잔잔해요 🌿',
  happy: '오늘 기분, 좋아 보여요 ☀️',
  sad: '오늘 좀 무거웠죠. 천천히 가요',
  angry: '마음에 힘이 들어갔네요. 잠깐 숨 돌릴까요?',
}

export function captionFor(dominant: Emotion): string {
  return EMOTION_CAPTIONS[dominant]
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run tests/ui/orb/lib/orbCaption.test.ts` → PASS
- [ ] **Step 5: 전체 스위트 + 커밋**
```bash
npx vitest run
git add features/ui/orb/lib/orbCaption.ts tests/ui/orb/lib/orbCaption.test.ts
git commit -m "feat(orbCaption): 토스 톤 한 줄 카피 (TDD)"
```

---

## Task 6: "또렷" 글래스+오로라 캔버스 컴포넌트 (시각 검증)

**Files:**
- Modify: `features/ui/orb/ReactiveOrb.tsx` (엔진 소비 + crisp 렌더)

> 캔버스 렌더는 단위 테스트가 어려우므로 **시각 검증**으로 확인한다(run 스킬 또는 비주얼 컴패니언). 협업 체크포인트: 사용자와 함께 본다.

- [ ] **Step 1: 컴포넌트 구현** — `features/ui/orb/ReactiveOrb.tsx`를 다음 props 기반으로 교체:
  - props: `{ positive: number; stress: number; emotions: EmotionResult; recordCount: number; className?: string }`
  - `gradientColors(emotions)`로 from/to 색, `topTwoEmotions`의 지배 감정으로 `motionFor()` 호출, `opacityFromCount(recordCount)`로 채움, crisp 렌더(blur 최소, 채도↑, 작고 선명한 하이라이트, 또렷한 rim — spec §5).
  - 비주얼 컴패니언에서 확정한 스타일(글래스+오로라, 또렷)을 캔버스 2D로 구현. `prefers-reduced-motion` 시 호흡 정지.

- [ ] **Step 2: 시각 검증** — run 스킬 또는 비주얼 컴패니언으로 4감정 상태(평온/기쁨/슬픔/화남) + 단계(투명→채움)를 띄워 사용자와 함께 확인. 어색하면 파라미터 조정 후 재확인.

- [ ] **Step 3: 커밋**
```bash
git add features/ui/orb/ReactiveOrb.tsx
git commit -m "feat(ReactiveOrb): 또렷 글래스+오로라 + 엔진 소비 (시각 검증)"
```

---

## Self-Review (작성자 점검)

- **Spec 커버리지:** §5 색(2D 색공간/감정색/상위2 그라데이션/누적 내 색) → Task 2·3 ✅. §5 성장 5단계+투명도 → Task 1 ✅. §5 움직임·숨결 → Task 4 ✅. §5 3채널② 한 줄 카피 + §9 토스 톤 → Task 5 ✅. §5 또렷 글래스+오로라 캔버스 → Task 6 ✅(시각).
- **범위 밖:** 색 반응속도(천천히 쌓인 색 + 강한 감정 잠깐 번짐)와 명도 안전장치는 Task 6 캔버스에서 EMA/명도로 처리하거나 후속 미세조정. PiP·온보딩·피드백은 후속 플랜.
- **타입 일관성:** `Emotion`/`EmotionResult`(기존), `RGB`, `MotionParams`. `gradientColors`→`{from,to}`, `motionFor`→`MotionParams` 일관. `EMOTION_HUES` 값은 spec §5 = v1 일치.
- **플레이스홀더:** Task 1~5 전부 실제 코드. Task 6은 의도적으로 시각 검증(단위테스트 불가 영역) — 컴포넌트 코드는 실행 단계에서 작성.
