# 측정 세션·데이터 인터페이스 설계 (초안)

- 작성: 이정환 (③ 개인 데이터 관리 / ⑤ 감정 및 개인 상태 분석 / ⑥ 개인 맞춤 피드백), 2026-10-19
- 상태: **설계 초안**. 이 문서는 코드·DB schema를 바꾸지 않는다. `[합의 필요]` 표시 항목은 김우빈과 합의한 뒤 확정한다.
- 기준: `origin/main` (`d570e3f`). 역할분담 개정은 PR #1(`HANN1123/collab-setup-main`)에 있으며, 이 문서는 그 개정 내용(③ 개인 데이터 관리, ① 카메라·rPPG 전체 김우빈 담당)을 전제로 한다.

## 1. 범위

| 포함 | 제외 |
|---|---|
| 기존 `shared/storage` 구조 분석 | DB schema 변경 (`db.ts` 수정) |
| `RppgResult` 공통 인터페이스 초안 | 카메라·rPPG 알고리즘 구현 |
| 측정 세션 타입·테이블·저장 API 설계 | UI 수정 |
| Dexie v1 → v2 호환 확장 계획 | 관리자 기능 |
| Mock 기반 테스트 계획, 후속 Issue 목록 | 실제 저장 API 구현 |

## 2. 현재 저장 구조 분석

### 2.1 IndexedDB (`shared/storage/db.ts`)

- DB 이름 `onmaum`, Dexie **version 1**, 테이블 하나: `emotions: '++id, timestamp'`.
- `EmotionRecord`: `id`, `timestamp`(집계 구간 끝 시각), `duration`(감지된 시간 ms), `detectionRate`, `happy`/`calm`/`sad`/`angry`, `dominantEmotion`, `flatAffectScore`.
- 레코드는 `useEmotionRecorder`가 약 0.5초 분석 샘플을 1분 단위로 `aggregate()`해 저장한다. 측정 정지 시 1분 미만의 마지막 조각도 저장한다(2026-04-26 step3 설계 결정).
- **세션 개념이 저장소에 없다.** 측정 시작·종료(`app/measure/page.tsx`의 `active` 상태)는 메모리에만 있고, 레코드에 세션 식별자가 없다.

### 2.2 저장 API (`shared/storage/emotionRepository.ts`)

| 함수 | 사용처 |
|---|---|
| `addEmotionRecord(record)` | `useEmotionRecorder` (기본 `saveRecord`) |
| `getEmotionsByDateRange(start, end)` | `useCheckin`, `useNudge`, `TrendChart`, `/stats` |
| `getEmotionsByDate('YYYY-MM-DD')` | `useCheckin`, `useNudge`, `/stats` (로컬 자정 기준) |
| `deleteAllEmotions()` | 테스트에서만 사용. 화면 연결 없음. **emotions 테이블만** 비운다 |

저장 API를 거치지 않고 `db.emotions`를 직접 읽는 곳도 있다: `features/ui/report/RecentRecords.tsx`(최근 기록·개수), `app/measure/page.tsx`(개수). schema 확장 시 이 직접 접근도 영향 범위에 포함한다.

### 2.3 localStorage

| 키 | 내용 | 파일 |
|---|---|---|
| `onmaum_checkin_<YYYY-MM-DD>` | 일별 체크인 `{ slot: 'morning'\|'afternoon', report: 'agree'\|'worse'\|'better', atMs }[]`. 같은 슬롯은 덮어씀 | `dayState.ts` |
| `onmaum_nudge_<YYYY-MM-DD>` | 넛지 횟수·마지막 시각 | `dayState.ts` |
| `onmaum_settings` | 넛지 설정, 체크인 시간대, `calibrationOffset` | `settings.ts` |
| `onmaum_profile` | 온보딩 설문(스트레스 해소법) | `profile.ts` |

현재 자기보고(`SelfReport`)는 **"표시된 상태가 맞았는지"에 대한 일별 응답**이며 측정 세션과 연결되지 않는다. 보정값(`calibrationOffset`)으로만 쓰인다.

### 2.4 계산 계층의 의존

- `features/algorithm/stress/dailyStress.ts`, `features/ui/report/DailyReport.tsx`가 `EmotionRecord[]`를 받아 계산한다. 두 곳 모두 필드를 읽기만 하므로 **선택 필드를 추가해도 동작이 바뀌지 않는다.**
- `emotionAggregator.aggregate()`는 `EmotionRecordInput`(= `Omit<EmotionRecord, 'id'>`)을 반환한다. 선택 필드를 추가해도 반환 타입 호환이 유지된다.

## 3. `RppgResult` 공통 인터페이스 초안

> **미합의 초안. 앱 코드에서 사용하지 않는다.** 김우빈과 합의한 뒤 별도의 작은 계약 커밋으로 코드화한다.

원칙:

- 생산자는 김우빈(① rPPG)이다. RGB 수집부터 BPM·품질 값 산출까지 rPPG 모듈 안에서 끝낸다.
- 소비자는 이정환(③ 저장, ⑤ 추세·비교, ⑥ 피드백)이다. 소비자는 BPM을 다시 계산하지 않는다.
- 결과에는 **RGB 시계열·얼굴 영역 픽셀·영상 프레임을 넣지 않는다.** 저장 대상은 아래 숫자 요약뿐이다.

```ts
/** rPPG 측정 품질 단계. [합의 필요] 단계 수와 판정 기준은 김우빈이 정한다. */
export type RppgQuality = 'good' | 'fair' | 'poor' | 'unusable'

/** rPPG 모듈이 추정 구간 하나마다 내보내는 결과. (미합의 초안) */
export interface RppgResult {
  /** 추정 구간 시작 시각 */
  windowStart: Date
  /** 추정 구간 끝 시각. 저장 시 timestamp로 쓴다 */
  windowEnd: Date
  /** 추정 심박수(BPM). 추정 실패·신뢰 불가면 null */
  bpm: number | null
  /** 품질 단계 */
  quality: RppgQuality
  /** 0~1 품질 점수. [합의 필요] 산출 방식·필수 여부 */
  qualityScore: number
  /** 0~1, 구간 중 얼굴이 추적되어 유효 신호를 얻은 비율 (EmotionRecord.detectionRate와 대응) */
  validRatio: number
  /** 알고리즘·버전 식별자 (예: 'pos-v1'). 알고리즘 교체 후 추세 비교 시 구분용. [합의 필요] 명명 규칙 */
  method: string
}
```

`[합의 필요]` 목록:

1. **출력 주기·구간 길이**: 예) 10초 구간을 5초마다 내보내기. 저장량과 추세 해상도가 이 값에 달려 있다.
2. **`bpm: null` vs `quality: 'unusable'`의 관계**: `unusable`이면 반드시 `bpm === null`인지.
3. **HRV(IBI) 포함 여부**: 통화 중 HRV 신뢰도가 낮다는 기존 판단(README 로드맵)에 따라 1차 범위에서는 제외하자고 제안한다.
4. **전달 방식**: 콜백(`onResult(result)`) / 이벤트 / 훅 반환값. 기존 `useEmotionRecorder`처럼 테스트 주입이 가능해야 한다.
5. **타입 위치**: 생산자가 정의하는 원칙에 따라 `features/rppg/` 생성 시 그 안에 두고, `shared/storage`는 기존 `Emotion` 타입처럼 **type-only import**하는 방식을 제안한다. 그 전까지는 이 문서가 기준이다.
6. **기준 센서 비교 데이터**: 김우빈의 정확도 검증용 데이터(기준 센서 BPM)는 앱 저장소에 넣지 않고 실험 산출물로 따로 관리하자고 제안한다.

## 4. 측정 세션 데이터 설계

### 4.1 타입 (제안)

```ts
export type SessionStatus = 'active' | 'completed' | 'interrupted'
export type SessionEndReason = 'user-stop' | 'camera-error' | 'recovered'

/** 측정 세션 = "전화 시작"부터 "전화 종료"까지 한 구간 */
export interface MeasurementSession {
  /** crypto.randomUUID()로 앱에서 생성. 저장 전에도 레코드에 연결할 수 있고 내보내기·병합 시 충돌이 없다 */
  id: string
  startedAt: Date
  /** 정상 종료 또는 복구 시 기록. 진행 중이면 null */
  endedAt: Date | null
  status: SessionStatus
  endReason: SessionEndReason | null
  /** 마지막으로 살아 있음을 확인한 시각. 비정상 종료 판별용. 레코드 저장 여부와 무관하게 측정 중 주기적으로 갱신 */
  lastSeenAt: Date
}

/** rPPG 결과 저장 레코드 */
export interface HeartRateRecord {
  id: number
  sessionId: string
  /** = RppgResult.windowEnd */
  timestamp: Date
  windowMs: number
  bpm: number | null
  quality: RppgQuality
  qualityScore: number
  validRatio: number
  method: string
}

/** 세션 전후 자기보고. [합의 필요] 문항·척도는 ⑥ 문구(이정환)와 ④ 화면(김우빈)이 함께 정한다 */
export interface SessionSelfReport {
  id: number
  sessionId: string
  phase: 'pre' | 'post'
  /** 1~5 주관적 긴장도 (제안) */
  tension: number
  /** 1~5 주관적 기분 (제안) */
  mood: number
  at: Date
}
```

`EmotionRecord`에는 **선택 필드** `sessionId?: string`을 추가한다. 기존 레코드는 `sessionId`가 없는 "세션 미연결(legacy)" 레코드로 그대로 보존한다.

### 4.2 테이블 (Dexie v2 제안)

```ts
this.version(1).stores({
  emotions: '++id, timestamp',
})
this.version(2).stores({
  emotions: '++id, timestamp, sessionId',
  sessions: 'id, startedAt, status',
  heartRates: '++id, sessionId, timestamp',
  sessionSelfReports: '++id, sessionId, at',
})
```

- version 1 선언은 지우지 않는다.
- 기존 데이터를 변환하지 않으므로 `upgrade()` 함수가 필요 없다. 인덱스 추가와 테이블 생성만 일어난다.
- IndexedDB는 키가 `undefined`인 레코드를 인덱스에 넣지 않으므로, 기존 레코드는 `sessionId` 인덱스 조회에 나타나지 않는다. 의도한 동작이다.

### 4.3 저장 API (제안, `shared/storage/sessionRepository.ts`)

| 함수 | 동작 |
|---|---|
| `startSession(now?)` → `MeasurementSession` | `status: 'active'`로 생성 |
| `touchSession(id, now?)` | `lastSeenAt` 갱신. 측정 중 **고정 주기(제안 30초) 타이머**로 호출하며, 감정 레코드 저장 여부와 무관하다. 잘못 복구된 세션(`interrupted` + `'recovered'`)이면 `active`로 되돌린다 |
| `endSession(id, reason, now?)` | `active` 또는 자동 복구된 `interrupted`(`endReason: 'recovered'`)이면 `completed`로 바꾸고 `endedAt`·`endReason` 기록. 이미 `completed`이면 무시(멱등). 호출 전에 생존 갱신 타이머를 먼저 멈춘다 |
| `recoverInterruptedSessions(now?, staleMs?)` | `active`이면서 `lastSeenAt`이 `staleMs`(제안: 생존 갱신 주기의 4배, 2분)보다 오래된 세션을 `interrupted`로 바꾸고 `endedAt = lastSeenAt` 기록. 호출 시점은 4.4절 5번 |
| `getSessionsByDateRange(start, end)` | `startedAt` 기준 조회 (일별·주별 목록) |
| `getSessionDetail(id)` | 세션 + 연결된 감정·심박·자기보고 |
| `addHeartRateRecord(sessionId, result)` | `RppgResult` → `HeartRateRecord` 저장 |
| `addSessionSelfReport(input)` | 자기보고 저장 |

기존 `emotionRepository`의 함수 이름·시그니처·반환값은 바꾸지 않는다. `addEmotionRecord`는 선택 필드 `sessionId`가 담긴 입력을 그대로 저장한다.

### 4.4 생명주기와 예외 처리

1. **시작**: 측정 시작 시 `startSession()` → 반환된 `id`를 레코더에 전달한다. 레코더 쪽 연결 방식(옵션 추가 또는 `saveRecord` 래핑)은 `useEmotionRecorder`가 공동 영역이므로 `[합의 필요]`. 래핑하면 레코더 수정 없이 연결할 수 있어 우선 제안한다.
2. **진행**: 1분 집계 저장 시 레코드에 `sessionId`를 붙인다. 생존 갱신(`touchSession`)은 저장과 분리해 30초 타이머로 한다. 얼굴이 계속 검출되지 않아 `aggregate()`가 `null`을 반환하고 저장이 생략되는 동안에도 세션이 살아 있는 것으로 유지되게 하기 위해서다.
3. **종료**: 측정 정지 시 `endSession(id, 'user-stop')`. 레코더의 마지막 조각 저장은 비동기라 `endSession`보다 늦게 끝날 수 있다. 레코드에는 이미 `sessionId`가 붙으므로 연결은 깨지지 않고, 마지막 레코드의 `timestamp`가 `endedAt`보다 약간 늦을 수 있음을 조회·분석에서 허용한다.
4. **카메라 오류**: `endSession(id, 'camera-error')`.
5. **탭 닫힘·앱 중단과 복구**: 세션이 `active`로 남는다. `recoverInterruptedSessions()`는 (a) 앱 시작 시, (b) `startSession()` 직전, (c) 앱 시작 때 아직 신선해서 제외된 `active` 세션이 있으면 `staleMs` 뒤 한 번 더 호출한다. (c) 덕분에 중단 직후 빠르게 다시 열어도 그 세션이 계속 `active`로 남지 않는다. 판정은 `lastSeenAt`만 보므로, 다른 탭에서 측정 중이고 생존 갱신이 정상인 세션은 30초마다 갱신되어 복구 대상이 되지 않는다. 갱신 실패 등으로 살아 있는 세션이 잘못 `interrupted`로 바뀌면, 그 세션의 다음 `touchSession()` 성공 시 `endReason`이 `'recovered'`인 경우에 한해 `active`로 되돌리고 `endedAt`을 비운다. 사용자가 끝낸 세션(`completed`)은 되돌리지 않는다. 잘못 복구된 직후 사용자가 종료해도 `endSession()`이 그 세션을 `completed`로 확정하므로, 그 뒤 늦게 도착한 `touchSession()`이 세션을 되살리지 않는다.
6. **세션 생성 실패**: 측정은 계속하고 레코드는 `sessionId` 없이 저장한다(기존 동작과 같음). 오류는 기존 `saveError`와 같은 방식으로 알린다. 측정 자체를 막지 않는다.
7. **생존 갱신 실패**: `touchSession()` 실패는 기록(console)만 하고 측정·레코드 저장에 영향을 주지 않는다. 감정 레코드 저장과 생존 갱신은 원자적으로 묶지 않는다. 갱신이 계속 실패해 세션이 `interrupted`로 바뀌더라도 레코드의 `sessionId` 연결은 남으므로 데이터 손실은 없고, 세션 상태만 실제보다 이르게 끝난 것으로 보인다.
8. **종료 후 마지막 저장 실패**: 기존과 같이 `saveError`로 표시하고 1차 구현에서는 재시도하지 않는다. 세션은 `completed`로 유지하며, 해당 1분 미만 조각만 빠진다.
9. **빠른 종료·재시작**: 정지 직후 다시 시작하면 새 세션을 만든다. 직전 세션의 늦게 끝난 마지막 저장은 직전 세션 `id`를 그대로 가진다(레코더가 시작 시점의 `id`를 캡처). 테스트로 두 세션의 레코드가 섞이지 않음을 확인한다.
10. **자정 통과**: 세션은 나누지 않는다. 세션 목록은 `startedAt` 날짜에 속하고, 일별 감정·스트레스 계산은 지금처럼 레코드 `timestamp` 기준이라 결과가 바뀌지 않는다.

### 4.5 자기보고 구분

- **일별 체크인**(`onmaum_checkin_*`, localStorage)은 보정용으로 그대로 둔다. 이번 단계에서 IndexedDB로 옮기거나 이중 저장하지 않는다.
- **세션 자기보고**(`sessionSelfReports`)는 새 데이터다. 측정 전후 비교(⑤)와 휴식 전후 변화(⑥)에 쓴다.
- 일별 체크인은 응답 대상 세션을 알 수 없다. 체크인 문구는 세션이 아니라 최근 구간 스트레스(`recentStress`, `RECENT_WINDOW_MS`)로 만들어지기 때문이다. 분석에 함께 쓸 때는 다음 규칙으로 **추정 연결**만 하고 저장하지 않는다.
  - 체크인 문구 계산과 같은 구간, 즉 `timestamp`가 `[atMs - RECENT_WINDOW_MS, atMs]`에 드는 감정 레코드를 하나 이상 가진 세션만 후보로 둔다.
  - 후보가 없으면 연결하지 않는다. 하나면 그 세션에 연결한다.
  - 여러 개면 그 구간 안의 레코드 수가 가장 많은 세션에 연결한다. 동률이면 그 구간 안의 마지막 레코드가 더 늦은 세션을 고른다.
  - 분석 결과에는 추정 연결임을 표시해 세션 자기보고(직접 연결)와 구분한다.
- 이전(migration)이 필요해지면 별도 Issue로 다룬다.

### 4.6 개인정보·보관·삭제·내보내기

- 원본 영상·얼굴 이미지·raw frame·RGB 시계열은 **저장하지 않는다**(기존 최소 수집 원칙 유지). `HeartRateRecord`는 숫자 요약만 담는다.
- 보관 기간: 기존 결정(자동 삭제 없음)을 따른다. 사용자가 직접 삭제한다.
- 저장량 추정: 5초마다 심박 결과 1건이면 1시간에 720건이다. 한 건이 약 150바이트라 하루 8시간 측정 시 약 0.9MB, 1년 약 220MB다. **[합의 필요] 출력 주기에 따라 1분 요약 저장으로 줄이는 안**도 검토한다.
- 삭제: 새 `deleteAllPersonalData()`는 IndexedDB 모든 테이블과 `onmaum_` localStorage 키를 지운다. 범위(설정·프로필 포함 여부)는 화면 문구와 함께 정한다. 기존 `deleteAllEmotions()`는 시그니처를 유지한다.
- 내보내기: 기기 안에서 JSON 파일로만 만든다(서버 전송 없음). 최상위에 `schemaVersion: 2`와 내보낸 시각을 넣는다. CSV는 선택.

## 5. DB 호환성 검토

| 항목 | 판단 | 조치 |
|---|---|---|
| v1 데이터 보존 | v2는 인덱스·테이블 추가뿐이라 기존 레코드가 그대로 남는다 | v1 DB에 데이터를 넣고 v2로 여는 보존 테스트 필수 |
| 기존 조회 결과 | `timestamp` 인덱스 유지. 일별·범위 조회 결과 불변 | 보존 테스트에서 v1 데이터의 `getEmotionsByDate` 결과 비교 |
| 계산·화면 타입 | `sessionId`가 선택 필드라 `dailyStress`, `DailyReport`, `aggregate()` 타입 호환 | `npx tsc --noEmit` |
| 직접 접근 | `RecentRecords`, `/measure`의 `db.emotions` 직접 사용은 v2에서도 동작 | 영향 범위로 PR에 명시 |
| 여러 탭 동시 실행 | 구 버전 탭이 열려 있으면 v2 업그레이드가 대기(blocked)될 수 있다. Dexie 4는 기본적으로 versionchange 시 기존 연결을 닫는다 | `blocked`/`versionchange` 동작을 테스트로 확인하고, 필요하면 새로고침 안내 문구(UI 협의) |
| 다운그레이드 | 설치된 Dexie 4.4.2는 `VersionError`가 나면 버전을 지정하지 않고 다시 연다(`dexie.mjs`의 `tryOpenDB` 재시도). 따라서 v1 코드가 v2 DB를 열어도 기존 `emotions` 테이블은 쓸 수 있을 것으로 보인다. 다만 v1 코드가 저장하는 레코드에는 `sessionId`가 없다. 구 코드는 배포 전에 열어 둔 탭(새로고침 전까지 계속 실행)과, `public/sw.js`의 network-first 요청이 실패해 캐시로 폴백한 경우에 실행될 수 있다 | v2 DB를 v1 schema로 여는 동작을 테스트로 확인. 배포 후 되돌리기는 하지 않는 원칙 |
| 저장 키 | localStorage 키는 바꾸지 않는다 | — |

결론: **v1 데이터와 호환되는 확장이 가능하다.** schema 변경은 계약 변경이므로 김우빈에게 먼저 공유하고, Dexie v2 확장만 담은 작은 PR로 분리한다.

## 6. Mock 기반 테스트 계획

김우빈의 rPPG 모듈 없이 개발할 수 있도록 다음을 준비한다. 기존 `fake-indexeddb` 환경(`tests/setup.ts`)을 그대로 쓰고, 기존 recorder skip 4개는 유지한다. **이 절은 계획이며, 이번 작업에서 새 테스트를 실행하지 않았다.**

| 대상 | 테스트 위치 | 내용 |
|---|---|---|
| Mock 데이터 | `tests/shared/storage/fixtures.ts` (제안) | `makeRppgResult(overrides)`, `makeSession(overrides)`, 고정 시드로 BPM 시퀀스·품질 변화(`good`→`poor`→`unusable`/`bpm: null`)를 만드는 `mockRppgStream()` |
| v1 → v2 보존 | `tests/shared/storage/dbMigration.test.ts` | v1 schema로 DB를 만들고 레코드 저장 → 닫기 → `OnmaumDB`(v2)로 열기 → 개수·필드·`getEmotionsByDate` 결과 동일, `sessionId` 없음 확인 |
| 세션 생명주기 | `tests/shared/storage/sessionRepository.test.ts` | 시작·종료, 중복 종료 무시, 오래된 `active` 복구, 최근 `lastSeenAt` 세션은 복구 제외 후 `staleMs` 뒤 재검사에서 복구, 레코드 저장 없이 생존 갱신만 있는 세션 유지, 자정 통과 세션의 날짜 귀속 |
| 실패·경합 | 같은 파일 | `touchSession` 실패 시 레코드 저장 유지, 잘못 복구된 세션의 다음 갱신 시 `active` 복원(`completed`는 유지), 자동 복구된 세션에 대한 `endSession` 확정과 그 뒤 지연된 갱신 무시, 종료 후 늦게 끝난 마지막 저장의 `sessionId` 유지, 빠른 종료·재시작 시 두 세션 레코드 분리 |
| 다운그레이드 | `dbMigration.test.ts` | v2 DB를 v1 schema 선언으로 열어 `emotions` 읽기·쓰기 가능 여부 확인 |
| 체크인 추정 연결 | 후속(분석 Issue) | 후보 없음·하나·여러 개·동률 경우의 연결 결과 |
| 연결 | 같은 파일 | `sessionId`가 붙은 감정·심박·자기보고를 `getSessionDetail`로 함께 조회, legacy 레코드는 세션 조회에서 제외 |
| 심박 저장 | 같은 파일 | `RppgResult` → `HeartRateRecord` 변환, `bpm: null` 보존 |
| 입력 검증 | `tests/shared/storage/rppgResult.test.ts` | 계약 합의 후 `isValidRppgResult()` — 범위 밖 BPM(예: 30 미만·220 초과), 0~1 밖 비율, `windowEnd < windowStart` 거부 |
| 조회·삭제·내보내기 | 후속 | 일별·주별 세션 목록, `deleteAllPersonalData()` 후 모든 테이블·키 비어 있음, 내보내기 JSON의 `schemaVersion` |

## 7. 후속 개발 Issue 목록

Codex 검토 의견을 반영해, 실제 저장 구현보다 **계약 합의와 DB 확장·보존 검증을 먼저** 둔다.

| 순서 | Issue (브랜치 예시) | 담당 | 비고 |
|---|---|---|---|
| 1 | `RppgResult` 계약 합의·코드화 (`docs/rppg-result-contract`) | 공동 | 3절 `[합의 필요]` 6건 결정. 작은 계약 커밋 |
| 2 | Dexie v2 확장과 v1 데이터 보존 테스트 (`feat/storage-dexie-v2`) | 이정환 | schema 변경. 사전 공유. 4.2절·5절 |
| 3 | 세션 생성·종료·복구 API (`feat/storage-session-lifecycle`) | 이정환 | 4.3·4.4절. Mock 테스트 |
| 4 | 세션과 측정 화면·레코더 연결 (`feat/measure-session-link`) | 공동 | `app/measure`, `useEmotionRecorder` 공동 영역 |
| 5 | rPPG 결과 저장 API (`feat/storage-heart-rate`) | 이정환 | Mock으로 선개발, 실제 모듈 연결은 공동 |
| 6 | 세션 전후 자기보고 저장 (`feat/storage-session-self-report`) | 이정환 (화면 김우빈) | 문항·척도 합의 필요 |
| 7 | 일별·주별 조회, 전체 삭제, JSON 내보내기 (`feat/storage-export-delete`) | 이정환 (화면 김우빈) | 삭제 범위 문구 합의 |
| 8 | 기존 표정 감정·스트레스 로직 검토 (`refactor/emotion-stress-review`) | 이정환 | 테스트 기대값 변경 시 별도 공유 |
| 9 | 심박 개인 기준선·변화 추세 (`feat/heart-rate-baseline`) | 이정환 | `quality`가 낮은 결과 제외 규칙 |
| 10 | 감정·심박·자기보고 관계 분석 (`feat/state-correlation`) | 이정환 | 의료·진단 표현 금지 |
| 11 | 측정 전후 비교·개인 리포트 데이터 (`feat/report-session-data`) | 이정환 (화면 김우빈) | `features/ui/report` 공동 검토 |
| 12 | 상태·체크인 기반 휴식·자기점검 안내 규칙 (`feat/feedback-rest-rules`) | 이정환 | 문구·조건 담당 |
| 13 | 휴식 전후 변화와 피드백 이력 기록 (`feat/feedback-history`) | 이정환 | 새 테이블 필요 시 schema 변경 절차 재적용 |
| 14 | (선택) 생성형 AI 추가 조언 (`spike/ai-advice`) | 이정환 | 기기 밖 전송이 생기므로 옵트인·전송 범위 설계가 먼저 |
