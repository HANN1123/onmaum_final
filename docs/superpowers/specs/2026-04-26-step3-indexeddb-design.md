# Step 3 — IndexedDB 저장 (1분 집계) 설계

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

- **작성일**: 2026-04-26
- **대상 단계**: Step 3 (9단계 로드맵 중)
- **선행 단계**: Step 2 (웹캠 + 실시간 감정 분석) — 완료
- **후행 단계**: Step 4 (위험도 계산), Step 5 (추세 그래프)
- **상태**: Draft (사용자 리뷰 대기)

## 1. 목적과 범위

### 목적
Step 2에서 500ms 주기로 분석되는 감정 데이터(`EmotionResult`)를 1분 단위로 집계하여 IndexedDB에 영구 저장한다. 이 저장된 데이터는 Step 4(위험도 계산), Step 5(추세 그래프)의 기반이 된다.

### In Scope
- `EmotionRecord` 테이블 정의 (Dexie 스키마)
- 1분 집계 알고리즘 (순수 함수)
- 분석 루프 + 집계 + 저장을 통합한 React Hook
- IndexedDB 에러 처리 정책
- TDD 기반 단위 테스트 인프라 구축 (Vitest + 관련 도구)

### Out of Scope
- `DailyRisk` 테이블과 위험도 계산 로직 (Step 4)
- 자동 데이터 삭제 / 보존 정책 (디폴트: 무한 보존)
- 데이터 내보내기 / 수동 삭제 UI (Step 6+)
- 추세 그래프 시각화 (Step 5)
- Camera 권한/Stream 처리 변경 (Step 2 그대로 유지)

## 2. 데이터 모델

### `EmotionRecord` (Dexie 테이블 `emotions`)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | `number` (auto) | Primary key (Dexie `++id`) |
| `timestamp` | `Date` | 1분 record의 **종료 시점** (저장 순간). 인덱싱됨 |
| `duration` | `number` | 실제 얼굴이 감지된 ms 합 (~60000 max, 부분 record는 더 작음) |
| `detectionRate` | `number` | 0~1 범위. `duration` ÷ `해당 record를 만든 모든 sample의 intervalMs 합`. 1분 full record면 분모≈60000, 측정 정지 시 마지막 부분 record면 분모는 더 작음 (실제 측정 시간) |
| `happy` | `number` | 0~1 평균 확률 (감지 샘플 기준) |
| `calm` | `number` | 0~1 평균 (face-api `neutral`을 매핑) |
| `sad` | `number` | 0~1 평균 |
| `angry` | `number` | 0~1 평균 |
| `dominantEmotion` | `'happy' \| 'calm' \| 'sad' \| 'angry'` | 위 4개 평균 중 최대값에 해당하는 감정 |
| `flatAffectScore` | `number` | 0~1 범위. `1 - (감지된 샘플들 사이의 dominant 변화 횟수 / (감지샘플수 - 1))`. 미감지 샘플은 변화 카운트에서 제외. 감지샘플 ≤1이면 `1` |

### Dexie 스키마

```typescript
this.version(1).stores({
  emotions: '++id, timestamp',  // PK + timestamp 인덱스 (range 조회용)
})
```

### 핵심 결정 사항 (브레인스토밍 합의)

| # | 결정 | 합의 |
|---|---|---|
| 1 | **집계 단위** | 1분 동안의 500ms 샘플(약 120개)을 평균내서 `EmotionRecord` 1개로 저장. raw 샘플은 메모리에만 |
| 2 | **`flatAffectScore` 정의** | `1 - (dominant 변화 횟수 / (감지샘플수 - 1))` — 표정 변화 부재 비율. 1에 가까울수록 평탄 = 위험 신호 |
| 3 | **얼굴 미감지 처리** | 감지된 샘플만 평균 계산. 모든 record 저장 (1초만 감지돼도). `detectionRate` 필드로 신뢰도 명시 |
| 4 | **측정 세션과 1분 경계** | Rolling 1분 (측정 시작 시점부터 매 60초). 측정 정지 시 마지막 조각도 저장 (duration < 60000) |
| 5 | **데이터 보존 기간** | 무한 보존 (자동 삭제 정책 없음). 1년 약 175,000개 / 35MB로 IndexedDB 부담 없음 |
| 6 | **타임존** | 사용자 로컬 자정 기준. `DailyRisk.date` 도 동일 (Step 4에서 적용) |
| 7 | **Step 3 범위** | `EmotionRecord` 테이블만. `DailyRisk`는 Step 4에서 v2로 추가 |

## 3. 아키텍처

### 파일 구조

```
lib/
  db.ts                         ← Dexie 인스턴스 + 스키마 + 버전 (인프라)
  emotionRepository.ts          ← EmotionRecord CRUD (비즈니스 쿼리)
  emotionAggregator.ts          ← 순수 함수: 샘플 → AggregatedRecord
  emotionAnalysis.ts            ← (기존) 변경 없음
  riskCalculator.ts             ← (기존, Step 4)
  notification.ts               ← (기존, Step 7)

hooks/                          ← (신규 폴더)
  useEmotionRecorder.ts         ← 분석 루프 + 1분 집계 buffer + 자동 저장

components/                     ← 변경 없음
app/page.tsx                    ← useEmotionRecorder 사용으로 단순화
```

### 의존 관계 (단방향)

```
app/page.tsx
   ↓ uses
features/camera/hooks/useEmotionRecorder.ts
   ↓ uses
emotionAnalysis (분석)  +  emotionAggregator (집계)  +  emotionRepository (저장)
                                                        ↓ uses
                                                       db.ts (Dexie)
```

### 모듈 인터페이스

#### `shared/storage/db.ts`

```typescript
import Dexie, { type EntityTable } from 'dexie'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

export interface EmotionRecord {
  id: number
  timestamp: Date
  duration: number
  detectionRate: number
  happy: number; calm: number; sad: number; angry: number
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

**책임:** 인프라(연결, 스키마, 버전). 비즈니스 로직 없음.

#### `shared/storage/emotionRepository.ts`

```typescript
export type EmotionRecordInput = Omit<EmotionRecord, 'id'>

export async function addEmotionRecord(record: EmotionRecordInput): Promise<number>
export async function getEmotionsByDate(date: string): Promise<EmotionRecord[]>          // "YYYY-MM-DD" 로컬 자정~자정
export async function getEmotionsByDateRange(start: Date, end: Date): Promise<EmotionRecord[]>
export async function deleteAllEmotions(): Promise<void>                                  // Step 6+ UI에서 호출 예정
```

**책임:** DB 접근의 유일한 경로. 다른 모듈은 직접 `db.emotions.xxx`를 호출하지 않음.

#### `features/algorithm/emotion/emotionAggregator.ts`

```typescript
export interface EmotionSample {
  emotion: EmotionResult | null   // null = 얼굴 미감지
  intervalMs: number              // 보통 500
}

/**
 * 샘플 배열 → EmotionRecordInput 1개로 집계 (순수 함수)
 * - detected 샘플 0개면 null 반환 (저장하지 않음)
 * - flatAffectScore = 1 - (dominant 변화 횟수 / (감지샘플수 - 1)), 감지샘플 ≤1이면 1
 */
export function aggregate(
  samples: EmotionSample[],
  endTime: Date,
): EmotionRecordInput | null
```

**책임:** 순수 계산. side-effect 없음. TDD 주 적용 대상.

#### `features/camera/hooks/useEmotionRecorder.ts`

```typescript
interface Options {
  active: boolean                  // 측정 시작/정지 토글
  videoEl: HTMLVideoElement | null // CameraView가 준비한 비디오 요소
  intervalMs?: number              // default 500
  aggregateMs?: number             // default 60000
}

interface Result {
  currentEmotion: EmotionResult | null  // 최근 분석 결과 (UI 표시용)
  saveError: Error | null               // DB 저장 에러 (UI 표시 가능)
}

export function useEmotionRecorder(opts: Options): Result
```

**책임:**
- `active=true` && `videoEl` 준비 시 분석 루프 시작 (`setTimeout` 재귀)
- 결과를 buffer에 push (감지/미감지 모두)
- 매 `aggregateMs`마다 buffer를 `aggregate()`로 flush → `addEmotionRecord(...)`
- `active=false` 시 buffer flush(마지막 조각 저장) + cleanup
- Step 2의 `page.tsx` 분석 루프 코드를 흡수하여 `page.tsx`를 단순화

#### `app/page.tsx` 변경 요약

- 기존의 `useState`/`useRef`/`useEffect`로 흩어진 분석 루프 코드 제거
- `useEmotionRecorder({ active, videoEl })` 한 줄로 대체
- `currentEmotion`을 `EmotionDisplay`에 전달 (Step 2와 동일)
- DB open 실패 시 측정 시작 버튼 disable (에러 처리 정책)

## 4. 데이터 흐름

### 핵심 흐름 단계

| 단계 | 트리거 | 동작 | DB 저장 |
|---|---|---|---|
| **시작** | 측정 시작 클릭 → CameraView stream 준비 → videoEl 도착 | hook이 분석 루프 가동 | — |
| **샘플링** | 500ms 인터벌 | analyzeEmotion → buffer push + currentEmotion 갱신(UI) | — |
| **1분 flush** | 측정 시작/직전 flush로부터 wall clock 60초 경과 | aggregate 호출 → null이면 skip / 아니면 저장 → buffer 비움 | ✅ |
| **정지** | 측정 정지 클릭 (또는 unmount) | 마지막 잔여 buffer flush(부분 record) → 루프 중지 → currentEmotion null | ✅ (마지막 조각) |

### State 분리

| 데이터 | 어디 저장 | 용도 |
|---|---|---|
| `currentEmotion` | hook React state | UI 즉시 반영 (EmotionDisplay) |
| `buffer` | `useRef`로 관리 | 1분간 누적. state로 관리하면 매 500ms 리렌더 → 비효율 |

### "60초 경과" 기준

**Wall clock 기준** (`Date.now()` 비교). 분석이 가끔 늦거나 얼굴 미감지로 buffer가 비어도 시간 자체는 흐름. 실제 1분 단위로 record가 저장되어야 의미 명확.

## 5. 에러 처리

### 카테고리별 처리

| # | 에러 케이스 | 위치 | 처리 |
|---|---|---|---|
| 1 | IndexedDB open 실패 (시크릿 모드 일부, 미지원 환경) | `db.ts` 초기화 | catch → 안내 메시지 + **측정 시작 버튼 disable** |
| 2 | 저장 실패 (quota 초과 등) | `addEmotionRecord` | hook의 `saveError` state에 저장 → page.tsx에서 인라인 카드 표시. 다음 1분 record는 자동 재시도 |
| 3 | 조회 실패 (드뭄) | `getEmotionsByDate` 등 | catch → 빈 배열 반환. UI는 "데이터 없음" 표시 |
| 4 | analyzeEmotion 에러 | hook 분석 루프 | console.error + 해당 sample은 null 처리 → buffer에 push. 루프 계속 |
| 5 | 빈 buffer (1분간 얼굴 0번) | aggregator | `aggregate()`가 null 반환 → `addEmotionRecord` 호출 안 함 |
| 6 | unmount 도중 저장 in-flight | hook cleanup | `cancelled` 플래그 + setTimeout cleanup. 최악의 경우 record 1개 손실 — 허용 |

### UI 표시 정책

- **인라인 카드** (Step 2의 `cameraError` 알림과 동일 패턴) — 외부 라이브러리 없음, 사용자가 명확히 인지 가능
- DB open 실패 시 측정 자체를 막음 — "체험 모드"는 데이터 안 쌓이는 측정이 무의미하므로 제공 안 함

## 6. 테스트 전략

### 도구

| 영역 | 채택 | 이유 |
|---|---|---|
| 테스트 러너 | **Vitest** | 빠름, ESM 친화적, Next.js 14+ 공식 옵션, 설정 단순 |
| DOM 환경 | **happy-dom** | Vitest 기본, jsdom보다 빠름. 우리 use case에 충분 |
| React 테스팅 | `@testing-library/react` | 표준. `renderHook` 포함 |
| IndexedDB 모킹 | `fake-indexeddb` | Node 환경에서 표준 |

### 추가 의존성

```bash
npm install -D vitest @vitest/ui happy-dom \
              @testing-library/react @testing-library/jest-dom \
              fake-indexeddb
```

추가 파일: `vitest.config.ts`, `package.json`에 `"test": "vitest"` 스크립트.

### TDD 적용 강도

| 모듈 | 적용도 | 비고 |
|---|---|---|
| `emotionAggregator` | **엄격** (Red → Green → Refactor) | 순수 함수, 입출력 명확. 약속의 주 적용처 |
| `emotionRepository` | 적용 (fake-indexeddb integration) | CRUD 입출력 명확 |
| `useEmotionRecorder` | **best effort** | analyzeEmotion mock + fake timers 필요. 핵심 동작 위주 |
| `db.ts` | skip | 단순 인스턴스 정의 |

### `emotionAggregator` 핵심 테스트 케이스

```typescript
describe('aggregate', () => {
  it('빈 배열 → null')
  it('모두 미감지 (null만) → null')
  it('감지 1개 → 그 값 그대로 + flatAffectScore=1')
  it('모두 같은 dominant → flatAffectScore=1, 평균 정확')
  it('dominant이 매 샘플마다 바뀜 → flatAffectScore=0')
  it('4개 감정 분포 평균 정확 (예: 0.6/0.2/0.1/0.1)')
  it('dominant 선택 = 평균 max')
  it('duration = 감지된 sample의 intervalMs 합')
  it('detectionRate = duration / 총 intervalMs')
  it('감지 샘플 1개일 때 flatAffectScore=1 (분모 0 회피)')
  it('endTime이 timestamp에 정확히 반영')
})
```

### TDD 흐름 (implementation 시점)

1. `emotionAggregator` 테스트 먼저 (위 케이스) → 빨강
2. aggregator 구현 → 초록
3. `emotionRepository` 테스트 (CRUD 4~5 케이스) → 빨강
4. repository 구현 → 초록
5. `db.ts` 작성 (테스트 없이 인스턴스만)
6. `useEmotionRecorder` 테스트 (가능한 범위) → 빨강
7. hook 구현 → 초록
8. `app/page.tsx` 통합 → 수동 검증 (브라우저 새로고침)

## 7. 다음 단계 연결

### Implementation 단계 (writing-plans)
- 본 스펙 승인 후 `superpowers:writing-plans` 스킬을 invoke하여 implementation plan 작성
- TDD 흐름에 따라 모듈 단위로 구현
- 각 모듈 완료 시점에 `superpowers:verification-before-completion` 적용

### Step 4 진입 시 검토 사항 (메모리 참조)
- `project_step4_anger_compensation.md` — 화남 인식률 보정 정책을 `riskCalculator.ts`에 적용:
  - 임계값 비대칭 (angry는 25-30%, 다른 감정은 40%+)
  - `negativeRatio = sad + angry` 그룹화
  - 시간 가중
- `EmotionRecord.duration` 짧은 record는 위험도 계산 시 가중치 낮게 처리 (Step 3에서 모두 저장한 정책의 후속)

### Dexie 마이그레이션 (Step 4)
- `DailyRisk` 테이블 추가 시 `db.version(2).stores({...})` 한 줄 추가. 빈 테이블 추가는 사용자 데이터 영향 없음.
- `dailyRiskRepository.ts`도 추가하여 기존 `emotionRepository.ts`와 같은 패턴 유지.
