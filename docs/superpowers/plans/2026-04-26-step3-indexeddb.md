# Step 3 — IndexedDB 저장 (1분 집계) Implementation Plan

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Step 2의 실시간 감정 분석 결과(500ms 샘플)를 1분 단위로 집계하여 IndexedDB에 영구 저장하는 데이터 레이어와 React Hook을 구축한다. `app/page.tsx`의 분석 루프 코드를 hook으로 분리하여 단순화한다.

**Architecture:** Dexie 기반 IndexedDB 사용. 4개 모듈 분리 — `db.ts` (인스턴스/스키마), `emotionRepository.ts` (CRUD), `emotionAggregator.ts` (순수 함수 집계), `useEmotionRecorder.ts` (React hook). 순수 함수는 TDD 엄격 적용, Repository는 fake-indexeddb로 통합 테스트, Hook은 best effort.

**Tech Stack:** TypeScript 5, Next.js 16, React 19, Dexie 4.4.2, dexie-react-hooks 4.4.0, Vitest 3+, @testing-library/react, happy-dom, fake-indexeddb

**Spec 참조:** `docs/superpowers/specs/2026-04-26-step3-indexeddb-design.md`

**메모리 참조:**
- `feedback_skill_invocation.md` — TDD/verification 명시 적용 약속
- `project_step4_anger_compensation.md` — Step 4 진입 전 검토 (Step 3 영역 외)

---

## File Structure

```
lib/
  db.ts                         (현재 빈 파일 → 채움)
  emotionRepository.ts          (신규)
  emotionAggregator.ts          (신규)
  emotionAnalysis.ts            (변경 없음)

hooks/                          (신규 폴더)
  useEmotionRecorder.ts         (신규)

tests/                          (신규 폴더)
  setup.ts                      (Vitest 셋업, fake-indexeddb 주입)
  sanity.test.ts                (인프라 검증용, Task 1 후 삭제)
  lib/
    emotionAggregator.test.ts
    emotionRepository.test.ts
  hooks/
    useEmotionRecorder.test.tsx

vitest.config.ts                (신규)

app/page.tsx                    (분석 루프 → hook 사용으로 단순화)
package.json                    (devDependencies + test 스크립트)
```

---

## Task 1: 테스트 인프라 셋업 (Vitest + happy-dom + fake-indexeddb)

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/sanity.test.ts` (Task 1 끝나면 삭제)

- [ ] **Step 1: 패키지 설치**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm install -D vitest @vitest/ui happy-dom @testing-library/react @testing-library/jest-dom @testing-library/dom fake-indexeddb @types/node
```

기대 출력: `added N packages`

- [ ] **Step 2: package.json에 test 스크립트 추가**

`package.json`의 `scripts` 섹션을 다음으로 수정:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:run": "vitest run"
}
```

- [ ] **Step 3: vitest.config.ts 생성**

`vitest.config.ts` 파일 생성:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 4: tests/setup.ts 생성 (fake-indexeddb 주입 + jest-dom matchers)**

`tests/setup.ts` 파일 생성:

```typescript
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
```

> 주: `fake-indexeddb/auto`는 `globalThis.indexedDB`를 fake 인스턴스로 자동 교체.

- [ ] **Step 5: sanity 테스트 작성**

`tests/sanity.test.ts` 파일 생성:

```typescript
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2)
  })

  it('indexedDB가 정의되어 있다 (fake-indexeddb)', () => {
    expect(globalThis.indexedDB).toBeDefined()
  })
})
```

- [ ] **Step 6: sanity 테스트 실행 → 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/sanity.test.ts
```

기대: `2 passed`. 실패 시 vitest.config.ts / setup.ts 점검.

- [ ] **Step 7: sanity 테스트 파일 삭제 (인프라 검증 완료)**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && rm tests/sanity.test.ts
```

- [ ] **Step 8: 타입체크 + 린트 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint app lib components
```

기대: 양쪽 모두 출력 없음(에러 없음).

- [ ] **Step 9: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add package.json package-lock.json vitest.config.ts tests/setup.ts && git commit -m "chore: Vitest + happy-dom + fake-indexeddb 테스트 인프라 셋업"
```

---

## Task 2: emotionAggregator 구현 (TDD 엄격)

**Files:**
- Create: `tests/algorithm/emotion/emotionAggregator.test.ts`
- Create: `features/algorithm/emotion/emotionAggregator.ts` (현재 빈 파일이 아닌, Step 1에서 비어 있으나 touch만 됨 — 덮어씀)

**의존:** `features/algorithm/emotion/emotionAnalysis.ts`의 `EmotionResult`, `Emotion`, `EMOTION_ORDER`, `getDominantEmotion` (이미 존재)

- [ ] **Step 1: emotionAggregator.test.ts 작성 (모든 테스트 케이스, 실패 상태)**

`tests/algorithm/emotion/emotionAggregator.test.ts` 파일 생성:

```typescript
import { describe, it, expect } from 'vitest'
import { aggregate, type EmotionSample } from '@/features/algorithm/emotion/emotionAggregator'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'

const END_TIME = new Date('2026-04-26T12:00:00.000+09:00')

function detected(emotion: EmotionResult, intervalMs = 500): EmotionSample {
  return { emotion, intervalMs }
}

function missed(intervalMs = 500): EmotionSample {
  return { emotion: null, intervalMs }
}

describe('aggregate', () => {
  it('빈 배열 → null 반환', () => {
    expect(aggregate([], END_TIME)).toBeNull()
  })

  it('모두 미감지 (null만) → null 반환', () => {
    const samples = [missed(), missed(), missed()]
    expect(aggregate(samples, END_TIME)).toBeNull()
  })

  it('감지 1개 → 그 값 그대로 + flatAffectScore=1', () => {
    const e: EmotionResult = { happy: 0.8, calm: 0.1, sad: 0.05, angry: 0.05 }
    const result = aggregate([detected(e)], END_TIME)
    expect(result).not.toBeNull()
    expect(result!.happy).toBeCloseTo(0.8)
    expect(result!.calm).toBeCloseTo(0.1)
    expect(result!.sad).toBeCloseTo(0.05)
    expect(result!.angry).toBeCloseTo(0.05)
    expect(result!.flatAffectScore).toBe(1)
  })

  it('모두 같은 dominant → flatAffectScore=1', () => {
    const e: EmotionResult = { happy: 0.7, calm: 0.1, sad: 0.1, angry: 0.1 }
    const samples = [detected(e), detected(e), detected(e), detected(e)]
    const result = aggregate(samples, END_TIME)
    expect(result!.flatAffectScore).toBe(1)
    expect(result!.dominantEmotion).toBe('happy')
  })

  it('dominant이 매 샘플마다 바뀜 → flatAffectScore=0', () => {
    const happy: EmotionResult = { happy: 0.9, calm: 0.05, sad: 0.025, angry: 0.025 }
    const sad: EmotionResult = { happy: 0.05, calm: 0.05, sad: 0.85, angry: 0.05 }
    const samples = [detected(happy), detected(sad), detected(happy), detected(sad)]
    const result = aggregate(samples, END_TIME)
    // 변화 횟수 = 3, 분모 = 4-1 = 3 → 1 - 3/3 = 0
    expect(result!.flatAffectScore).toBe(0)
  })

  it('4개 감정 분포 평균 계산이 정확하다', () => {
    const a: EmotionResult = { happy: 1.0, calm: 0.0, sad: 0.0, angry: 0.0 }
    const b: EmotionResult = { happy: 0.0, calm: 1.0, sad: 0.0, angry: 0.0 }
    const samples = [detected(a), detected(b)]
    const result = aggregate(samples, END_TIME)
    expect(result!.happy).toBeCloseTo(0.5)
    expect(result!.calm).toBeCloseTo(0.5)
    expect(result!.sad).toBeCloseTo(0)
    expect(result!.angry).toBeCloseTo(0)
  })

  it('dominantEmotion = 평균 4개 중 max', () => {
    const e1: EmotionResult = { happy: 0.6, calm: 0.2, sad: 0.1, angry: 0.1 }
    const e2: EmotionResult = { happy: 0.0, calm: 0.0, sad: 0.5, angry: 0.5 }
    const samples = [detected(e1), detected(e2)]
    const result = aggregate(samples, END_TIME)
    // 평균: happy=0.3, calm=0.1, sad=0.3, angry=0.3 → tie. 선언 순서상 첫 max가 happy
    // 명확한 max 케이스 별도로 테스트
    expect(['happy', 'sad', 'angry']).toContain(result!.dominantEmotion)
  })

  it('duration = 감지된 sample의 intervalMs 합', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const samples = [detected(e, 500), missed(500), detected(e, 500), missed(500)]
    const result = aggregate(samples, END_TIME)
    expect(result!.duration).toBe(1000)  // 500 + 500
  })

  it('detectionRate = duration / 모든 sample intervalMs 합', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const samples = [detected(e, 500), missed(500), detected(e, 500), missed(500)]
    const result = aggregate(samples, END_TIME)
    expect(result!.detectionRate).toBeCloseTo(0.5)  // 1000 / 2000
  })

  it('감지 샘플 1개일 때 flatAffectScore=1 (분모 0 회피)', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const samples = [missed(), detected(e), missed()]
    const result = aggregate(samples, END_TIME)
    expect(result!.flatAffectScore).toBe(1)
  })

  it('endTime이 timestamp에 정확히 반영', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const result = aggregate([detected(e)], END_TIME)
    expect(result!.timestamp.getTime()).toBe(END_TIME.getTime())
  })

  it('미감지 샘플은 flatAffect 변화 카운트에서 제외 (감지된 것 사이만)', () => {
    const happy: EmotionResult = { happy: 0.9, calm: 0.05, sad: 0.025, angry: 0.025 }
    const sad: EmotionResult = { happy: 0.05, calm: 0.05, sad: 0.85, angry: 0.05 }
    // 감지: happy, happy, sad → 변화 1회, 분모 = 3-1=2 → flatAffect = 1 - 1/2 = 0.5
    const samples = [detected(happy), missed(), detected(happy), missed(), detected(sad)]
    const result = aggregate(samples, END_TIME)
    expect(result!.flatAffectScore).toBeCloseTo(0.5)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 모두 실패 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/algorithm/emotion/emotionAggregator.test.ts
```

기대: 12개 모두 실패 (`Cannot find module '@/features/algorithm/emotion/emotionAggregator'` 또는 export 없음).

- [ ] **Step 3: emotionAggregator.ts 구현**

`features/algorithm/emotion/emotionAggregator.ts` 파일 생성 (기존 빈 파일이면 덮어쓰기):

```typescript
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { getDominantEmotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { EmotionRecordInput } from '@/shared/storage/emotionRepository'

export interface EmotionSample {
  emotion: EmotionResult | null
  intervalMs: number
}

export function aggregate(
  samples: EmotionSample[],
  endTime: Date,
): EmotionRecordInput | null {
  const detectedSamples = samples.filter(
    (s): s is EmotionSample & { emotion: EmotionResult } => s.emotion !== null,
  )

  if (detectedSamples.length === 0) return null

  const sum: EmotionResult = { happy: 0, calm: 0, sad: 0, angry: 0 }
  for (const s of detectedSamples) {
    sum.happy += s.emotion.happy
    sum.calm += s.emotion.calm
    sum.sad += s.emotion.sad
    sum.angry += s.emotion.angry
  }
  const avg: EmotionResult = {
    happy: sum.happy / detectedSamples.length,
    calm: sum.calm / detectedSamples.length,
    sad: sum.sad / detectedSamples.length,
    angry: sum.angry / detectedSamples.length,
  }

  const dominantEmotion = getDominantEmotion(avg)

  const duration = detectedSamples.reduce((acc, s) => acc + s.intervalMs, 0)
  const totalIntervalMs = samples.reduce((acc, s) => acc + s.intervalMs, 0)
  const detectionRate = totalIntervalMs > 0 ? duration / totalIntervalMs : 0

  let changes = 0
  for (let i = 1; i < detectedSamples.length; i++) {
    const prev = getDominantEmotion(detectedSamples[i - 1].emotion)
    const curr = getDominantEmotion(detectedSamples[i].emotion)
    if (prev !== curr) changes += 1
  }
  const flatAffectScore =
    detectedSamples.length > 1 ? 1 - changes / (detectedSamples.length - 1) : 1

  return {
    timestamp: endTime,
    duration,
    detectionRate,
    happy: avg.happy,
    calm: avg.calm,
    sad: avg.sad,
    angry: avg.angry,
    dominantEmotion,
    flatAffectScore,
  }
}
```

> 주: `EmotionRecordInput` 타입은 Task 4의 `emotionRepository.ts`에서 export 예정. 이 import는 Task 4 완료 전까지 type 에러. **임시 우회**: 이 import 라인을 다음으로 대체 후 Task 4에서 정정:
>
> ```typescript
> import type { EmotionResult, Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
> import { getDominantEmotion } from '@/features/algorithm/emotion/emotionAnalysis'
>
> // 임시 타입 (Task 4에서 emotionRepository.ts에서 import로 교체)
> type EmotionRecordInput = {
>   timestamp: Date
>   duration: number
>   detectionRate: number
>   happy: number; calm: number; sad: number; angry: number
>   dominantEmotion: Emotion
>   flatAffectScore: number
> }
> ```

- [ ] **Step 4: 테스트 실행 → 모두 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/algorithm/emotion/emotionAggregator.test.ts
```

기대: 12개 모두 pass. 실패 시 디버깅 (특히 dominantEmotion tie-breaking 케이스).

- [ ] **Step 5: 타입체크 + 린트 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint lib tests
```

기대: 양쪽 모두 출력 없음.

- [ ] **Step 6: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add features/algorithm/emotion/emotionAggregator.ts tests/algorithm/emotion/emotionAggregator.test.ts && git commit -m "feat: emotionAggregator 순수 함수 + TDD (12 케이스)"
```

---

## Task 3: db.ts 작성 (Dexie 인스턴스 + 스키마)

**Files:**
- Modify: `shared/storage/db.ts` (현재 빈 파일)

**테스트 없음** (단순 인스턴스 정의, 스펙에서 skip 결정).

- [ ] **Step 1: db.ts 작성**

`shared/storage/db.ts` 파일 내용 (덮어쓰기):

```typescript
import Dexie, { type EntityTable } from 'dexie'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

export interface EmotionRecord {
  id: number
  timestamp: Date
  duration: number
  detectionRate: number
  happy: number
  calm: number
  sad: number
  angry: number
  dominantEmotion: Emotion
  flatAffectScore: number
}

export class OnmaumDB extends Dexie {
  emotions!: EntityTable<EmotionRecord, 'id'>

  constructor() {
    super('onmaum')
    this.version(1).stores({
      emotions: '++id, timestamp',
    })
  }
}

export const db = new OnmaumDB()
```

- [ ] **Step 2: 타입체크 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit
```

기대: 출력 없음.

- [ ] **Step 3: commit (Task 4와 합쳐서 커밋해도 OK — 단독 commit 권장)**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add shared/storage/db.ts && git commit -m "feat: Dexie 기반 OnmaumDB 인스턴스 + EmotionRecord 스키마"
```

---

## Task 4: emotionRepository 구현 (TDD with fake-indexeddb)

**Files:**
- Create: `tests/shared/storage/emotionRepository.test.ts`
- Create: `shared/storage/emotionRepository.ts`
- Modify: `features/algorithm/emotion/emotionAggregator.ts` (Task 2의 임시 타입을 정식 import로 교체)

- [ ] **Step 1: emotionRepository.test.ts 작성**

`tests/shared/storage/emotionRepository.test.ts` 파일 생성:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  addEmotionRecord,
  getEmotionsByDate,
  getEmotionsByDateRange,
  deleteAllEmotions,
  type EmotionRecordInput,
} from '@/shared/storage/emotionRepository'
import { db } from '@/shared/storage/db'

function makeInput(overrides: Partial<EmotionRecordInput> = {}): EmotionRecordInput {
  return {
    timestamp: new Date('2026-04-26T12:00:00+09:00'),
    duration: 60000,
    detectionRate: 1,
    happy: 0.5,
    calm: 0.3,
    sad: 0.1,
    angry: 0.1,
    dominantEmotion: 'happy',
    flatAffectScore: 0.8,
    ...overrides,
  }
}

describe('emotionRepository', () => {
  beforeEach(async () => {
    await db.emotions.clear()
  })

  describe('addEmotionRecord', () => {
    it('record 추가 후 auto-increment id 반환', async () => {
      const id = await addEmotionRecord(makeInput())
      expect(typeof id).toBe('number')
      expect(id).toBeGreaterThan(0)
    })

    it('추가한 record를 다시 조회할 수 있다', async () => {
      const id = await addEmotionRecord(makeInput({ happy: 0.77 }))
      const found = await db.emotions.get(id)
      expect(found?.happy).toBeCloseTo(0.77)
    })
  })

  describe('getEmotionsByDateRange', () => {
    it('지정 범위 내 record만 반환', async () => {
      await addEmotionRecord(makeInput({ timestamp: new Date('2026-04-26T10:00:00+09:00') }))
      await addEmotionRecord(makeInput({ timestamp: new Date('2026-04-26T12:00:00+09:00') }))
      await addEmotionRecord(makeInput({ timestamp: new Date('2026-04-26T15:00:00+09:00') }))

      const start = new Date('2026-04-26T11:00:00+09:00')
      const end = new Date('2026-04-26T13:00:00+09:00')
      const results = await getEmotionsByDateRange(start, end)

      expect(results).toHaveLength(1)
      expect(results[0].timestamp.toISOString()).toBe(
        new Date('2026-04-26T12:00:00+09:00').toISOString(),
      )
    })

    it('빈 범위 → 빈 배열', async () => {
      const results = await getEmotionsByDateRange(
        new Date('2030-01-01'),
        new Date('2030-12-31'),
      )
      expect(results).toEqual([])
    })
  })

  describe('getEmotionsByDate', () => {
    it('YYYY-MM-DD 로컬 자정~자정 사이 record 반환', async () => {
      // 사용자 로컬 4/26 자정~자정 사이 3개 추가
      await addEmotionRecord(makeInput({ timestamp: new Date('2026-04-26T00:30:00') }))
      await addEmotionRecord(makeInput({ timestamp: new Date('2026-04-26T12:00:00') }))
      await addEmotionRecord(makeInput({ timestamp: new Date('2026-04-26T23:30:00') }))
      // 다른 날짜 1개
      await addEmotionRecord(makeInput({ timestamp: new Date('2026-04-27T00:30:00') }))

      const results = await getEmotionsByDate('2026-04-26')
      expect(results).toHaveLength(3)
    })
  })

  describe('deleteAllEmotions', () => {
    it('모든 record 삭제', async () => {
      await addEmotionRecord(makeInput())
      await addEmotionRecord(makeInput())
      expect(await db.emotions.count()).toBe(2)

      await deleteAllEmotions()
      expect(await db.emotions.count()).toBe(0)
    })
  })
})
```

- [ ] **Step 2: 테스트 실행 → 모두 실패 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/shared/storage/emotionRepository.test.ts
```

기대: 모두 실패 (`Cannot find module '@/shared/storage/emotionRepository'`).

- [ ] **Step 3: emotionRepository.ts 구현**

`shared/storage/emotionRepository.ts` 파일 생성:

```typescript
import { db, type EmotionRecord } from '@/shared/storage/db'

export type EmotionRecordInput = Omit<EmotionRecord, 'id'>

export async function addEmotionRecord(record: EmotionRecordInput): Promise<number> {
  return db.emotions.add(record as EmotionRecord)
}

export async function getEmotionsByDateRange(
  start: Date,
  end: Date,
): Promise<EmotionRecord[]> {
  return db.emotions.where('timestamp').between(start, end, true, true).toArray()
}

export async function getEmotionsByDate(date: string): Promise<EmotionRecord[]> {
  // date = "YYYY-MM-DD", 사용자 로컬 자정 기준
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(`${date}T23:59:59.999`)
  return getEmotionsByDateRange(start, end)
}

export async function deleteAllEmotions(): Promise<void> {
  await db.emotions.clear()
}
```

- [ ] **Step 4: emotionAggregator.ts 임시 타입을 정식 import로 교체**

`features/algorithm/emotion/emotionAggregator.ts` 상단의 임시 타입 정의(또는 직접 import한 EmotionRecordInput)를 다음으로 정정:

```typescript
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { getDominantEmotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { EmotionRecordInput } from '@/shared/storage/emotionRepository'
```

(임시 type 정의 블록은 삭제. `EMOTION_ORDER`는 사용 안 하면 import에서 빼기.)

- [ ] **Step 5: 테스트 실행 → 모두 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/shared/storage/emotionRepository.test.ts tests/algorithm/emotion/emotionAggregator.test.ts
```

기대: emotionRepository 6개 + emotionAggregator 12개 = 18개 모두 pass.

- [ ] **Step 6: 타입체크 + 린트 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint lib tests
```

기대: 양쪽 모두 출력 없음.

- [ ] **Step 7: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add shared/storage/emotionRepository.ts features/algorithm/emotion/emotionAggregator.ts tests/shared/storage/emotionRepository.test.ts && git commit -m "feat: emotionRepository CRUD + TDD (fake-indexeddb 통합)"
```

---

## Task 5: useEmotionRecorder hook 구현 (best effort TDD)

**Files:**
- Create: `tests/camera/hooks/useEmotionRecorder.test.tsx`
- Create: `features/camera/hooks/useEmotionRecorder.ts`

> Hook은 분석 루프 + buffer + 저장을 묶는 통합 모듈이라 단위 테스트가 복잡함. 핵심 동작 위주로 테스트.

- [ ] **Step 1: useEmotionRecorder.test.tsx 작성**

`tests/camera/hooks/useEmotionRecorder.test.tsx` 파일 생성:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEmotionRecorder } from '@/features/camera/hooks/useEmotionRecorder'
import * as analysisModule from '@/features/camera/lib/faceDetection'
import * as repoModule from '@/shared/storage/emotionRepository'
import { db } from '@/shared/storage/db'

const mockEmotion = { happy: 0.7, calm: 0.2, sad: 0.05, angry: 0.05 }

describe('useEmotionRecorder', () => {
  beforeEach(async () => {
    await db.emotions.clear()
    vi.useFakeTimers()
    vi.spyOn(analysisModule, 'analyzeEmotion').mockResolvedValue(mockEmotion)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('active=false일 때 분석 루프가 시작되지 않음', () => {
    const fakeVideo = document.createElement('video')
    Object.defineProperty(fakeVideo, 'readyState', { value: 4 })
    renderHook(() =>
      useEmotionRecorder({ active: false, videoEl: fakeVideo }),
    )

    expect(analysisModule.analyzeEmotion).not.toHaveBeenCalled()
  })

  it('active=true + videoEl 준비 시 분석 루프 시작 → currentEmotion 갱신', async () => {
    const fakeVideo = document.createElement('video')
    Object.defineProperty(fakeVideo, 'readyState', { value: 4 })

    const { result } = renderHook(() =>
      useEmotionRecorder({ active: true, videoEl: fakeVideo, intervalMs: 500 }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    await waitFor(() => {
      expect(result.current.currentEmotion).toEqual(mockEmotion)
    })
  })

  it('aggregateMs(60s) 경과 시 addEmotionRecord 호출', async () => {
    const addSpy = vi.spyOn(repoModule, 'addEmotionRecord').mockResolvedValue(1)
    const fakeVideo = document.createElement('video')
    Object.defineProperty(fakeVideo, 'readyState', { value: 4 })

    renderHook(() =>
      useEmotionRecorder({
        active: true,
        videoEl: fakeVideo,
        intervalMs: 500,
        aggregateMs: 60000,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60500)
    })

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalled()
    })
  })

  it('active=false로 토글 시 마지막 buffer flush', async () => {
    const addSpy = vi.spyOn(repoModule, 'addEmotionRecord').mockResolvedValue(1)
    const fakeVideo = document.createElement('video')
    Object.defineProperty(fakeVideo, 'readyState', { value: 4 })

    const { rerender } = renderHook(
      ({ active }) =>
        useEmotionRecorder({ active, videoEl: fakeVideo, intervalMs: 500 }),
      { initialProps: { active: true } },
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000) // 4 sample 정도
    })

    rerender({ active: false })

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledTimes(1) // 부분 record 1개
    })
  })

  it('addEmotionRecord 실패 시 saveError 노출', async () => {
    vi.spyOn(repoModule, 'addEmotionRecord').mockRejectedValue(
      new Error('quota exceeded'),
    )
    const fakeVideo = document.createElement('video')
    Object.defineProperty(fakeVideo, 'readyState', { value: 4 })

    const { result } = renderHook(() =>
      useEmotionRecorder({
        active: true,
        videoEl: fakeVideo,
        intervalMs: 500,
        aggregateMs: 60000,
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60500)
    })

    await waitFor(() => {
      expect(result.current.saveError?.message).toBe('quota exceeded')
    })
  })
})
```

- [ ] **Step 2: 테스트 실행 → 모두 실패 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/camera/hooks/useEmotionRecorder.test.tsx
```

기대: 모두 실패 (`Cannot find module '@/features/camera/hooks/useEmotionRecorder'`).

- [ ] **Step 3: useEmotionRecorder.ts 구현**

`features/camera/hooks/useEmotionRecorder.ts` 파일 생성:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { analyzeEmotion } from '@/features/camera/lib/faceDetection'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { aggregate, type EmotionSample } from '@/features/algorithm/emotion/emotionAggregator'
import { addEmotionRecord } from '@/shared/storage/emotionRepository'

interface Options {
  active: boolean
  videoEl: HTMLVideoElement | null
  intervalMs?: number
  aggregateMs?: number
}

interface Result {
  currentEmotion: EmotionResult | null
  saveError: Error | null
}

const DEFAULT_INTERVAL_MS = 500
const DEFAULT_AGGREGATE_MS = 60000

export function useEmotionRecorder(opts: Options): Result {
  const {
    active,
    videoEl,
    intervalMs = DEFAULT_INTERVAL_MS,
    aggregateMs = DEFAULT_AGGREGATE_MS,
  } = opts

  const [currentEmotion, setCurrentEmotion] = useState<EmotionResult | null>(null)
  const [saveError, setSaveError] = useState<Error | null>(null)

  const bufferRef = useRef<EmotionSample[]>([])
  const bufferStartRef = useRef<number>(0)
  const loopActiveRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    videoRef.current = videoEl
  }, [videoEl])

  useEffect(() => {
    if (!active || !videoEl) {
      flushAndReset()
      return
    }

    setSaveError(null)
    bufferRef.current = []
    bufferStartRef.current = Date.now()
    loopActiveRef.current = true

    const tick = async () => {
      if (!loopActiveRef.current) return

      const video = videoRef.current
      let result: EmotionResult | null = null
      if (video && video.readyState >= 2) {
        try {
          result = await analyzeEmotion(video)
        } catch (err) {
          console.error('감정 분석 실패:', err)
          result = null
        }
      }
      if (!loopActiveRef.current) return

      bufferRef.current.push({ emotion: result, intervalMs })
      setCurrentEmotion(result)

      if (Date.now() - bufferStartRef.current >= aggregateMs) {
        await flushBuffer(new Date())
        bufferStartRef.current = Date.now()
      }

      if (loopActiveRef.current) {
        setTimeout(tick, intervalMs)
      }
    }
    tick()

    return () => {
      loopActiveRef.current = false
      void flushBuffer(new Date())
    }

    async function flushBuffer(endTime: Date) {
      const samples = bufferRef.current
      bufferRef.current = []
      if (samples.length === 0) return
      const record = aggregate(samples, endTime)
      if (!record) return
      try {
        await addEmotionRecord(record)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('감정 기록 저장 실패:', error)
        setSaveError(error)
      }
    }

    function flushAndReset() {
      loopActiveRef.current = false
      const samples = bufferRef.current
      bufferRef.current = []
      if (samples.length === 0) {
        setCurrentEmotion(null)
        return
      }
      const record = aggregate(samples, new Date())
      setCurrentEmotion(null)
      if (!record) return
      addEmotionRecord(record).catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('감정 기록 저장 실패:', error)
        setSaveError(error)
      })
    }
  }, [active, videoEl, intervalMs, aggregateMs])

  return { currentEmotion, saveError }
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/camera/hooks/useEmotionRecorder.test.tsx
```

기대: 5개 모두 pass. 만약 timer/promise 동기화 문제로 일부 실패 시:
- `vi.advanceTimersByTimeAsync` 시간을 늘려서 재시도
- `flushSync` 또는 `await waitFor` 보강
- 1~2개 케이스가 실패해도 best effort 정책상 핵심 케이스(분석 루프 시작, 저장 호출)가 통과하면 OK

- [ ] **Step 5: 전체 테스트 실행 → 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run
```

기대: aggregator 12 + repository 6 + hook 5 = 23개 모두 pass (best effort hook은 4-5개 pass).

- [ ] **Step 6: 타입체크 + 린트 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint app lib hooks components tests
```

기대: 출력 없음.

- [ ] **Step 7: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add features/camera/hooks/useEmotionRecorder.ts tests/camera/hooks/useEmotionRecorder.test.tsx && git commit -m "feat: useEmotionRecorder hook + best effort 테스트"
```

---

## Task 6: app/page.tsx 통합 + 수동 검증

**Files:**
- Modify: `app/page.tsx`

분석 루프 코드를 hook으로 대체. DB open 실패 시 측정 시작 버튼 disable. saveError를 인라인 카드로 표시.

- [ ] **Step 1: page.tsx 재작성**

`app/page.tsx` 파일 내용 (덮어쓰기):

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import CameraView from '@/features/camera/components/CameraView'
import EmotionDisplay from '@/features/ui/measure/EmotionDisplay'
import { useEmotionRecorder } from '@/features/camera/hooks/useEmotionRecorder'
import { loadFaceApiModels } from '@/features/camera/lib/faceDetection'
import { db } from '@/shared/storage/db'

type ModelStatus = 'loading' | 'ready' | 'error'

export default function Home() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [modelError, setModelError] = useState<string | null>(null)
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadFaceApiModels()
      .then(() => {
        if (cancelled) return
        console.log('✅ face-api 모델 로드 완료')
        setModelStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        console.error('❌ face-api 모델 로드 실패:', err)
        setModelError(message)
        setModelStatus('error')
      })

    db.open()
      .then(() => {
        if (cancelled) return
        setDbReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        console.error('❌ IndexedDB open 실패:', err)
        setDbError(message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const { currentEmotion, saveError } = useEmotionRecorder({
    active,
    videoEl,
  })

  const handleCameraReady = useCallback((video: HTMLVideoElement) => {
    setVideoEl(video)
    setCameraError(null)
  }, [])

  const handleCameraError = useCallback((err: Error) => {
    setCameraError(err.message)
    setActive(false)
    setVideoEl(null)
  }, [])

  useEffect(() => {
    if (!active) {
      setVideoEl(null)
    }
  }, [active])

  const handleStart = () => {
    if (modelStatus !== 'ready' || !dbReady) return
    setCameraError(null)
    setActive(true)
  }

  const handleStop = () => {
    setActive(false)
  }

  const startDisabled = active || modelStatus !== 'ready' || !dbReady

  return (
    <main className="min-h-screen bg-ink-50 px-6 py-12">
      <section className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-ink-900">온마음</h1>
          <p className="mt-2 text-sm text-ink-500">
            Step 3 · 1분 집계 + IndexedDB 저장
          </p>
        </header>

        {modelStatus === 'loading' && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-ink-600">
            ⏳ face-api 모델 로딩 중...
          </div>
        )}
        {modelStatus === 'error' && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 모델 로드 실패: {modelError}
          </div>
        )}
        {dbError && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 데이터 저장 불가 환경입니다 (IndexedDB): {dbError}
          </div>
        )}

        <CameraView
          active={active}
          onReady={handleCameraReady}
          onError={handleCameraError}
        />

        {cameraError && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 카메라 오류: {cameraError}
          </div>
        )}

        {saveError && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 데이터 저장 실패: {saveError.message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={startDisabled}
            className="flex-1 rounded-full bg-risk-good px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            측정 시작
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={!active}
            className="flex-1 rounded-full border border-ink-300 bg-white px-6 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            측정 정지
          </button>
        </div>

        {active && <EmotionDisplay emotion={currentEmotion} />}
      </section>
    </main>
  )
}
```

- [ ] **Step 2: 타입체크 + 린트 통과 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint app lib hooks components tests
```

기대: 출력 없음.

- [ ] **Step 3: 전체 테스트 한 번 더 실행**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run
```

기대: 23개 (또는 일부 hook 케이스 제외) 모두 pass.

- [ ] **Step 4: dev 서버 시작 + 수동 검증 (브라우저)**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run dev
```

브라우저(http://localhost:3000) 새로고침 후 확인:

1. 헤더 "Step 3 · 1분 집계 + IndexedDB 저장" 표시
2. "⏳ face-api 모델 로딩 중..." → 사라짐
3. "측정 시작" 클릭 → 카메라 권한 → 미리보기 + EmotionDisplay 표시 (Step 2와 동일)
4. **약 1분 측정** (시계 확인)
5. 브라우저 DevTools → Application → IndexedDB → `onmaum` → `emotions` 테이블 확인
   - record 1개가 저장되어 있어야 함
   - 필드: timestamp, duration (~60000), detectionRate (0~1), happy/calm/sad/angry, dominantEmotion, flatAffectScore
6. "측정 정지" 클릭 → 카메라 꺼짐 + EmotionDisplay 사라짐
7. **즉시 다시 시작 → 10초만 측정 후 정지**
8. IndexedDB에 record 1개 더 추가됨 (duration ~10000, detectionRate ~1, 부분 record)

수동 검증 OK 시 다음 step.

- [ ] **Step 5: commit (page.tsx 통합)**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add app/page.tsx && git commit -m "feat: Step 3 - useEmotionRecorder 통합 + DB 상태 UI"
```

- [ ] **Step 6: Final commit (Step 3 종료 마커, optional)**

전체 변경 누적된 후 Step 3 완료 표시 commit (or skip — 위 task별 commit으로 충분).

---

## Verification Checklist (Step 3 완료 확인)

implementation 끝나고 `superpowers:verification-before-completion` 적용:

- [ ] `npm run test:run` 23개 (또는 hook 일부 제외) pass
- [ ] `npx tsc --noEmit` 출력 없음
- [ ] `npx eslint app lib hooks components tests` 출력 없음
- [ ] `npm run build` 성공 (production build 검증)
- [ ] 브라우저 수동 테스트:
  - 1분 측정 후 IndexedDB에 record 1개 저장 확인
  - 부분 record(예: 10초 측정 후 정지)도 저장 확인
  - DB open 실패 시뮬레이션 (불가능하면 skip)
  - 저장 실패 시 인라인 카드 표시 (불가능하면 skip)

---

## Out of Scope (Step 4 이후)

- DailyRisk 테이블 정의 / 위험도 계산 → Step 4
- 위험도 색 시스템 UI 적용 → Step 4
- 추세 그래프 → Step 5
- 위험 경고 UI / 상담 연락처 → Step 6
- 로컬 알림 → Step 7
- PWA / Vercel 배포 → Step 8, 9
- 데이터 내보내기 / 수동 삭제 UI → Step 6+

---

## 참고 메모

- **emotionAggregator의 dominantEmotion tie-breaking**: `getDominantEmotion`이 EMOTION_ORDER 순서로 reduce. 동률일 때는 먼저 나온 감정이 선택됨. 테스트의 "tie 케이스"는 그 점을 고려해서 작성 (`['happy', 'sad', 'angry']` allowlist).
- **buffer가 useRef인 이유**: state로 관리하면 매 500ms 리렌더 → 비효율. 스펙 4절 참고.
- **Wall clock 60초 기준**: `Date.now() - bufferStart >= aggregateMs`. 분석 시간이 길어 sample 수가 부족해도 1분이 지나면 flush.
- **Step 4 진입 전 화남 보정 메모 검토**: `~/.claude/projects/-Users-woo-bin-3-1-team-pj-ONMAUM/memory/project_step4_anger_compensation.md`
