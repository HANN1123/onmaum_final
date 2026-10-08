# 스트레스 지수 엔진 (P0+P1) Implementation Plan

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

> 아래 Task 1의 함수 추출·행 번호는 당시 혼합 파일에 대한 기록입니다. 현재 `analyzeEmotion`과 모델 로딩은 `features/camera/lib/faceDetection.ts`, 정규화 함수와 감정 타입은 `features/algorithm/emotion/emotionAnalysis.ts`에 있습니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 감정 인식 정확도 보강(disgust 합치기)과 2축 스트레스 지수(긍정 P / 스트레스 N) 산출 엔진을 순수 함수 + TDD로 구현한다.

**Architecture:** 모두 부수효과 없는 순수 함수로 `lib/`에 둔다. 프레임 단위 기여도 → 구간 집계(duration 가중) → 파생값(마음균형/정서활력), 그리고 순간 오탐을 거르는 지속 게이트와 "지금값"용 EMA. UI/녹화 훅 연결은 후속 플랜(오브·피드백)에서.

**Tech Stack:** TypeScript, Vitest(`@/` alias, happy-dom, globals), face-api.js(기존). 기존 `ANGRY_WEIGHT`(=1.5) 재사용.

**Spec:** `docs/superpowers/specs/2026-06-08-onmaum-v2-orb-stress-design.md` §3, §4

---

## File Structure

- `features/algorithm/emotion/emotionAnalysis.ts` (수정) — `normalizeExpressions()` 추출 + disgust를 angry(적대 정서)에 합침. `analyzeEmotion()`이 이를 사용.
- `features/algorithm/stress/stressIndex.ts` (생성) — 2축 지수 순수 함수 모음: `frameContribution`, `aggregateStress`, `mindBalance`, `affectEnergy`, `gateSustainedNegative`, `emaStress` + 상수.
- `tests/algorithm/emotion/emotionAnalysis.test.ts` (생성) — `normalizeExpressions` 테스트.
- `tests/algorithm/stress/stressIndex.test.ts` (생성) — 엔진 함수 테스트.

후속 플랜(이 플랜 범위 밖): 오브 렌더 엔진(P2), PiP 오버레이(P3), 온보딩 설문·피드백·하이브리드 기준선 배선(P4), 데모 흐름(P5), HSEmotion(P6).

---

## Task 1: disgust를 angry에 합치는 정규화 추출 (P0)

**Files:**
- Modify: `features/algorithm/emotion/emotionAnalysis.ts` (라인 35-60 `analyzeEmotion` 내부 정규화 로직을 함수로 추출)
- Test: `tests/algorithm/emotion/emotionAnalysis.test.ts` (생성)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/algorithm/emotion/emotionAnalysis.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeExpressions } from '@/features/algorithm/emotion/emotionAnalysis'

describe('normalizeExpressions', () => {
  it('disgust를 angry(적대 정서)에 합친다', () => {
    const r = normalizeExpressions({ happy: 0, neutral: 0, sad: 0, angry: 0.2, disgusted: 0.2 })
    expect(r.angry).toBeCloseTo(1) // (0.2+0.2)/0.4
    expect(r.happy).toBeCloseTo(0)
    expect(r.calm).toBeCloseTo(0)
    expect(r.sad).toBeCloseTo(0)
  })

  it('neutral→calm 매핑 + 합으로 정규화', () => {
    const r = normalizeExpressions({ happy: 1, neutral: 1, sad: 0, angry: 0, disgusted: 0 })
    expect(r.happy).toBeCloseTo(0.5)
    expect(r.calm).toBeCloseTo(0.5)
  })

  it('합이 0이면 calm=1 폴백', () => {
    expect(normalizeExpressions({ happy: 0, neutral: 0, sad: 0, angry: 0, disgusted: 0 }))
      .toEqual({ happy: 0, calm: 1, sad: 0, angry: 0 })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/algorithm/emotion/emotionAnalysis.test.ts`
Expected: FAIL — `normalizeExpressions` is not exported / not a function.

- [ ] **Step 3: 최소 구현**

`features/algorithm/emotion/emotionAnalysis.ts` — 기존 `analyzeEmotion`의 라인 45-59 정규화 블록을 아래 함수로 추출하고, `analyzeEmotion`은 이를 호출하도록 교체. 파일 상단(타입 정의 부근)에 추가:
```ts
export interface RawExpressions {
  happy: number
  neutral: number
  sad: number
  angry: number
  disgusted: number
}

export function normalizeExpressions(raw: RawExpressions): EmotionResult {
  const happy = raw.happy
  const calm = raw.neutral
  const sad = raw.sad
  const angry = raw.angry + raw.disgusted // disgust를 적대/부정 정서로 합침 (spec §3)
  const sum = happy + calm + sad + angry
  if (sum <= 0) return { happy: 0, calm: 1, sad: 0, angry: 0 }
  return { happy: happy / sum, calm: calm / sum, sad: sad / sum, angry: angry / sum }
}
```
그리고 `analyzeEmotion` 내부(라인 45-59)를 다음으로 교체:
```ts
  if (!detection) return null
  return normalizeExpressions(detection.expressions)
```
(`detection.expressions`는 happy/neutral/sad/angry/disgusted를 포함하므로 `RawExpressions`와 구조적으로 호환된다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/algorithm/emotion/emotionAnalysis.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add features/algorithm/emotion/emotionAnalysis.ts tests/algorithm/emotion/emotionAnalysis.test.ts
git commit -m "feat(emotionAnalysis): disgust를 angry에 합치는 normalizeExpressions 추출 (TDD)"
```

---

## Task 2: 프레임 기여도 (긍정/부정)

**Files:**
- Create: `features/algorithm/stress/stressIndex.ts`
- Test: `tests/algorithm/stress/stressIndex.test.ts` (생성)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/algorithm/stress/stressIndex.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { frameContribution } from '@/features/algorithm/stress/stressIndex'

describe('frameContribution', () => {
  it('pos=happy, neg=sad + angry×1.5', () => {
    const c = frameContribution({ happy: 0.5, calm: 0.2, sad: 0.1, angry: 0.2 })
    expect(c.pos).toBeCloseTo(0.5)
    expect(c.neg).toBeCloseTo(0.1 + 0.2 * 1.5) // 0.4
  })

  it('calm은 긍정에 들어가지 않는다', () => {
    const c = frameContribution({ happy: 0, calm: 1, sad: 0, angry: 0 })
    expect(c.pos).toBeCloseTo(0)
    expect(c.neg).toBeCloseTo(0)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: FAIL — Cannot find module `@/features/algorithm/stress/stressIndex`.

- [ ] **Step 3: 최소 구현**

`features/algorithm/stress/stressIndex.ts` 생성:
```ts
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { ANGRY_WEIGHT } from '@/features/algorithm/stress/riskCalculator'

export function frameContribution(e: EmotionResult): { pos: number; neg: number } {
  return { pos: e.happy, neg: e.sad + e.angry * ANGRY_WEIGHT }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add features/algorithm/stress/stressIndex.ts tests/algorithm/stress/stressIndex.test.ts
git commit -m "feat(stressIndex): 프레임 기여도 frameContribution (TDD)"
```

---

## Task 3: 구간 집계 (2축 P/N) + 파생값

**Files:**
- Modify: `features/algorithm/stress/stressIndex.ts`
- Test: `tests/algorithm/stress/stressIndex.test.ts` (추가)

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/algorithm/stress/stressIndex.test.ts`에 describe 블록 추가)

```ts
import { aggregateStress, mindBalance, affectEnergy } from '@/features/algorithm/stress/stressIndex'

describe('aggregateStress', () => {
  it('빈 배열 → null', () => {
    expect(aggregateStress([])).toBeNull()
  })

  it('총 duration 0 → null', () => {
    expect(aggregateStress([{ happy: 1, sad: 0, angry: 0, duration: 0 }])).toBeNull()
  })

  it('기쁨만 가득 → 긍정 100, 스트레스 0', () => {
    const s = aggregateStress([{ happy: 1, sad: 0, angry: 0, duration: 60000 }])!
    expect(s.positive).toBeCloseTo(100)
    expect(s.stress).toBeCloseTo(0)
  })

  it('화남 0.4 → 스트레스 = 100 × (0.4×1.5) = 60', () => {
    const s = aggregateStress([{ happy: 0, sad: 0, angry: 0.4, duration: 1000 }])!
    expect(s.stress).toBeCloseTo(60)
  })

  it('duration 가중 평균 — 긴 record가 더 큰 영향', () => {
    const s = aggregateStress([
      { happy: 0, sad: 1, angry: 0, duration: 60000 },
      { happy: 1, sad: 0, angry: 0, duration: 15000 },
    ])!
    // stress: (1×60000 + 0×15000)/75000 ×100 = 80
    expect(s.stress).toBeCloseTo(80)
    // positive: (0×60000 + 1×15000)/75000 ×100 = 20
    expect(s.positive).toBeCloseTo(20)
  })
})

describe('파생값', () => {
  it('마음균형 = 긍정 − 스트레스', () => {
    expect(mindBalance({ positive: 70, stress: 40 })).toBeCloseTo(30)
  })
  it('정서활력 = 긍정 + 스트레스', () => {
    expect(affectEnergy({ positive: 70, stress: 40 })).toBeCloseTo(110)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: FAIL — `aggregateStress`/`mindBalance`/`affectEnergy` not exported.

- [ ] **Step 3: 최소 구현** (`features/algorithm/stress/stressIndex.ts`에 추가)

```ts
export interface StressScores {
  positive: number // 0~100
  stress: number // 0~100
}

interface StressInput {
  happy: number
  sad: number
  angry: number
  duration: number
}

export function aggregateStress(records: StressInput[]): StressScores | null {
  const total = records.reduce((sum, r) => sum + r.duration, 0)
  if (records.length === 0 || total <= 0) return null

  let weightedPos = 0
  let weightedNeg = 0
  for (const r of records) {
    weightedPos += r.happy * r.duration
    weightedNeg += (r.sad + r.angry * ANGRY_WEIGHT) * r.duration
  }
  return {
    positive: (100 * weightedPos) / total,
    stress: (100 * weightedNeg) / total,
  }
}

export function mindBalance(s: StressScores): number {
  return s.positive - s.stress
}

export function affectEnergy(s: StressScores): number {
  return s.positive + s.stress
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add features/algorithm/stress/stressIndex.ts tests/algorithm/stress/stressIndex.test.ts
git commit -m "feat(stressIndex): 2축 구간 집계 aggregateStress + 파생값 (TDD)"
```

---

## Task 4: 지속 게이트 (순간 오탐 배제)

**Files:**
- Modify: `features/algorithm/stress/stressIndex.ts`
- Test: `tests/algorithm/stress/stressIndex.test.ts` (추가)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { gateSustainedNegative, NEG_PRESENT_THRESHOLD, MIN_SUSTAIN_MS } from '@/features/algorithm/stress/stressIndex'

describe('gateSustainedNegative', () => {
  it('3초 이상 지속된 부정만 인정', () => {
    const frames = Array.from({ length: 5 }, () => ({ neg: 0.6, intervalMs: 1000 }))
    expect(gateSustainedNegative(frames)).toEqual([0.6, 0.6, 0.6, 0.6, 0.6])
  })

  it('잠깐 튄 부정(1초)은 0으로 배제', () => {
    const frames = [
      { neg: 0, intervalMs: 1000 },
      { neg: 0.6, intervalMs: 1000 }, // 단발 스파이크
      { neg: 0, intervalMs: 1000 },
    ]
    expect(gateSustainedNegative(frames)).toEqual([0, 0, 0])
  })

  it('임계 미만 부정은 부정 프레임이 아님 → 0', () => {
    const frames = Array.from({ length: 5 }, () => ({ neg: 0.2, intervalMs: 1000 }))
    expect(gateSustainedNegative(frames)).toEqual([0, 0, 0, 0, 0])
  })

  it('상수 기본값', () => {
    expect(NEG_PRESENT_THRESHOLD).toBe(0.4)
    expect(MIN_SUSTAIN_MS).toBe(3000)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: FAIL — `gateSustainedNegative` 등 not exported.

- [ ] **Step 3: 최소 구현** (`features/algorithm/stress/stressIndex.ts`에 추가)

```ts
export const NEG_PRESENT_THRESHOLD = 0.4
export const MIN_SUSTAIN_MS = 3000

export interface NegFrame {
  neg: number
  intervalMs: number
}

/**
 * 부정(neg ≥ negThreshold)이 minSustainMs 이상 "연속"된 구간만 neg를 유지하고,
 * 짧게 튄 스파이크나 임계 미만 프레임은 0으로 만든다. (spec §4: 지속된 부정만 인정)
 */
export function gateSustainedNegative(
  frames: NegFrame[],
  opts?: { negThreshold?: number; minSustainMs?: number },
): number[] {
  const negThreshold = opts?.negThreshold ?? NEG_PRESENT_THRESHOLD
  const minSustainMs = opts?.minSustainMs ?? MIN_SUSTAIN_MS

  const out = frames.map(() => 0)
  let i = 0
  while (i < frames.length) {
    if (frames[i].neg >= negThreshold) {
      let j = i
      let runMs = 0
      while (j < frames.length && frames[j].neg >= negThreshold) {
        runMs += frames[j].intervalMs
        j++
      }
      if (runMs >= minSustainMs) {
        for (let k = i; k < j; k++) out[k] = frames[k].neg
      }
      i = j
    } else {
      i++
    }
  }
  return out
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add features/algorithm/stress/stressIndex.ts tests/algorithm/stress/stressIndex.test.ts
git commit -m "feat(stressIndex): 지속 게이트 gateSustainedNegative — 순간 오탐 배제 (TDD)"
```

---

## Task 5: EMA (지금값 스무딩)

**Files:**
- Modify: `features/algorithm/stress/stressIndex.ts`
- Test: `tests/algorithm/stress/stressIndex.test.ts` (추가)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { emaStress, EMA_ALPHA } from '@/features/algorithm/stress/stressIndex'

describe('emaStress', () => {
  it('이전값 null → 현재값 그대로', () => {
    expect(emaStress(null, 70)).toBe(70)
  })

  it('이전 0, 현재 100, alpha 0.5 → 50', () => {
    expect(emaStress(0, 100, 0.5)).toBeCloseTo(50)
  })

  it('기본 alpha 적용', () => {
    expect(EMA_ALPHA).toBe(0.3)
    expect(emaStress(0, 100)).toBeCloseTo(30)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: FAIL — `emaStress`/`EMA_ALPHA` not exported.

- [ ] **Step 3: 최소 구현** (`features/algorithm/stress/stressIndex.ts`에 추가)

```ts
export const EMA_ALPHA = 0.3

/** 지금값(현재 상태) 스무딩 — 최근 값에 가중. prev가 null이면 현재값으로 시작. */
export function emaStress(prev: number | null, current: number, alpha: number = EMA_ALPHA): number {
  return prev === null ? current : prev + alpha * (current - prev)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/algorithm/stress/stressIndex.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: 전체 테스트 + 커밋**

```bash
npx vitest run
git add features/algorithm/stress/stressIndex.ts tests/algorithm/stress/stressIndex.test.ts
git commit -m "feat(stressIndex): 지금값 스무딩 emaStress (TDD)"
```
Expected: 전체 스위트 PASS (기존 테스트 포함).

---

## Self-Review (작성자 점검 결과)

- **Spec 커버리지:** §3 disgust 합치기 → Task 1 ✅. §4 2축 P/N 산출(긍정=happy, 스트레스=sad+angry×1.5, duration 가중, 0~100) → Task 2·3 ✅. §4 지속 게이트 → Task 4 ✅. §4 EMA 지금값 → Task 5 ✅. 파생(마음균형/정서활력) → Task 3 ✅.
- **이 플랜 범위 밖(후속):** 하이브리드 개인 기준선(P4 배선), 누적 보너스(추후 튜닝), 오브/PiP/온보딩/데모. §15 보류(N 변동성)는 의도적 제외.
- **타입 일관성:** `EmotionResult`(기존), `StressScores{positive,stress}`, `NegFrame{neg,intervalMs}` 일관. `ANGRY_WEIGHT`는 `riskCalculator`에서 import(단일 출처).
- **플레이스홀더:** 없음. 모든 스텝에 실제 코드/명령/기대결과 포함.
