# Step 6 — 위험 경고 UI + 상담 연락처 설계

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

- **작성일**: 2026-04-27
- **대상 단계**: Step 6 (9단계 로드맵 중)
- **선행 단계**: Step 5 (추세 그래프) — 완료
- **후행 단계**: Step 7 (로컬 알림), Step 8 (PWA), Step 9 (Vercel 배포)
- **상태**: Draft (사용자 리뷰 대기)

## 1. 목적과 범위

### 목적
DailyRisk 위험도가 **'warning'** 상태일 때 사용자에게 경고 모달을 띄우고, 정신건강 hotline(1577-0199 / 1393) 등 안전망을 노출한다. 일상적으로는 자기 돌봄 팁(SelfCareTip)을 부드럽게 권유한다.

### 도덕적 책임 짚을 점
이 단계는 **사용자 안전과 직결**된다. 톤·메시지·표시 빈도 모두 신중하게 잡아야 함:
- 단정적/낙인적 표현 금지 ("당신은 우울증입니다" ❌)
- 사용자 통제권 존중 (dismiss 가능, 강요 X)
- 안전망(hotline)은 위급 시 즉각 접근 가능
- 알림 피로 방지 (그날 1회만)

### In Scope
- `RiskWarningModal` — warning 상태 첫 진입 시 1회 모달
- `ContactsFooter` — 모든 페이지 푸터에 hotline 항상 노출
- `SelfCareTip` — 한 줄 자기 돌봄 카드 (회전 가능)
- `useWarningDismissal` hook — sessionStorage 기반 dismiss 추적
- `lib/selfCareTips.ts` — 정적 팁 리스트 + 랜덤 select 함수
- 위 컴포넌트들에 대한 테스트

### Out of Scope
- 로컬 알림 (Step 7)
- PWA (Step 8)
- 배포 (Step 9)
- 위험도 계산 로직 변경 (Step 4 그대로)
- 자기 돌봄 팁의 데이터베이스화 / 사용자 즐겨찾기 등

## 2. 결정 사항 요약 (브레인스토밍 합의)

| # | 항목 | 결정 |
|---|---|---|
| 1 | **트리거 정책** | warning 첫 진입 시 1회 (sessionStorage로 그날 dismissed 추적). 자정 넘어가면 자동 reset. |
| 2 | **UI 형태** | 모달 (화면 가림 + "알겠어요" 버튼) |
| 3 | **메시지 톤** | 부드러운 권유 — "🌿 잠시 마음을 살펴요. 잠시 쉬어가거나 도움을 받아보는 것은 어떨까요?" |
| 4 | **상담 연락처** | 1577-0199 (정신건강위기상담) + 1393 (자살예방). 모달 안 + 페이지 푸터에 항상 표시 |
| 5 | **SelfCareTip** | 항상 한 줄 카드, 사용자 클릭 시 회전 (다른 tip으로 교체) |
| 6 | **risk 악화 시 재등장** | 안 함 (그날 1회 한정 — 사용자 통제권 존중) |
| 7 | **여러 탭 동기화** | sessionStorage 사용 (탭별 분리, 의도된 trade-off) |

## 3. 아키텍처

### 파일 구조

```
hooks/
  useWarningDismissal.ts        ← 신규
  useEmotionRecorder.ts         ← 변경 없음

components/
  RiskWarningModal.tsx          ← 신규
  ContactsFooter.tsx            ← 신규
  SelfCareTip.tsx               ← 채움 (현재 빈 파일)
  CameraView.tsx                ← 변경 없음
  EmotionDisplay.tsx            ← 변경 없음
  DailyRiskCard.tsx             ← 변경 없음
  TrendChart.tsx                ← 변경 없음
  RecentRecords.tsx             ← 변경 없음

lib/
  selfCareTips.ts               ← 신규 (정적 팁 + select 함수)

app/page.tsx                    ← 수정 (위 컴포넌트들 조립)
```

### 의존 관계 (단방향)

```
app/page.tsx
   ├─ uses → useWarningDismissal (모달 표시 여부 결정)
   ├─ uses → DailyRiskCard, TrendChart, RecentRecords (기존)
   ├─ uses → SelfCareTip (신규)
   ├─ uses → RiskWarningModal (조건부 렌더)
   └─ uses → ContactsFooter (항상)

RiskWarningModal
   └─ 정적 (1577-0199, 1393 하드코딩)

SelfCareTip
   └─ uses → lib/selfCareTips (selectRandomTip)

ContactsFooter
   └─ 정적
```

### 모듈 인터페이스

#### `hooks/useWarningDismissal.ts`

```typescript
interface Result {
  dismissed: boolean
  dismiss: () => void
}

export function useWarningDismissal(date: string): Result
```

- sessionStorage key: `onmaum-warning-dismissed-${date}`
- `date` 인자 변하면 (자정 넘어가면) 자동 reset
- sessionStorage 접근 실패 시 안전 측: `dismissed = false` (모달 표시)

#### `components/RiskWarningModal.tsx`

```typescript
interface Props {
  open: boolean
  onClose: () => void
}

export default function RiskWarningModal(props: Props): JSX.Element | null
```

- `open=false`면 `null` 반환 (렌더 비용 0)
- 헤드: "🌿 잠시 마음을 살펴요"
- 본문: 부드러운 권유 카피
- 연락처 2개 (`tel:1577-0199`, `tel:1393`)
- 닫기 경로: "알겠어요" 버튼 / ESC 키 / 배경 클릭

#### `features/ui/common/ContactsFooter.tsx`

```typescript
export default function ContactsFooter(): JSX.Element
```

- props 없음 (정적)
- 위치: 페이지 맨 아래
- 내용: "도움이 필요하면: 📞 1577-0199 · 📞 1393" (작은 글씨, ink-500 톤)
- `tel:` 링크

#### `components/SelfCareTip.tsx`

```typescript
export default function SelfCareTip(): JSX.Element
```

- 내부 state: `useState<SelfCareTip>` 현재 표시 중인 팁
- 페이지 진입 시 `selectRandomTip()` (current 없음 → 완전 랜덤)
- 🔄 클릭 시 `selectRandomTip(current)` (현재와 다른 tip 선택)
- 한 줄 카드 형태

#### `lib/selfCareTips.ts`

```typescript
export interface SelfCareTip {
  icon: string      // 이모지
  text: string      // "물 한 잔 마셔보세요" 등
}

export const TIPS: SelfCareTip[]                          // 최소 5개

/**
 * 랜덤 팁 선택. currentTip 주어지면 그것과 다른 tip 반환 (회전 시 중복 방지).
 * TIPS 길이가 1이면 어쩔 수 없이 같은 tip 반환.
 */
export function selectRandomTip(currentTip?: SelfCareTip): SelfCareTip
```

#### `app/page.tsx` 변경 요약

```typescript
const today = new Date().toLocaleDateString('en-CA')
const todayRecords = useLiveQuery(() => getEmotionsByDate(today), [today])
const todayRisk = todayRecords ? aggregateDailyRisk(todayRecords, today) : null
const { dismissed, dismiss } = useWarningDismissal(today)
const showWarning = todayRisk?.riskLevel === 'warning' && !dismissed

// JSX 추가
<DailyRiskCard />
<TrendChart />
<SelfCareTip />            ← 신규
<RecentRecords />
<ContactsFooter />         ← 신규 (페이지 맨 아래)
<RiskWarningModal open={showWarning} onClose={dismiss} />
```

## 4. 데이터 흐름

### 위험 경고 모달 트리거 시퀀스

```
사용자 페이지 진입
   ↓
useLiveQuery(getEmotionsByDate(today)) → todayRecords
   ↓
aggregateDailyRisk(todayRecords, today) → todayRisk
   ↓
useWarningDismissal(today) → { dismissed, dismiss }
   ↓
showWarning = (todayRisk?.riskLevel === 'warning') && !dismissed
   ↓
<RiskWarningModal open={showWarning} onClose={dismiss} />
   ↓
모달 등장 → 사용자 dismiss → sessionStorage.setItem(key, 'true')
                                  ↓
                          showWarning=false 다음 렌더 → 모달 unmount
```

### 자동 갱신 (record 추가 → 모달 등장)

측정 중 1분마다 record 저장 → useLiveQuery 자동 감지 → todayRisk 재계산 → riskLevel='warning' && not dismissed면 모달 자동 표시.

→ **측정 중 갑자기 모달이 뜰 수 있음.** 의도대로 (실시간 위험 신호 즉시 안내).

### 모달 떴을 때 백그라운드 동작

| 컴포넌트 | 동작 |
|---|---|
| `useEmotionRecorder` | 계속 측정 (분석 루프 안 멈춤) |
| `useLiveQuery` | 계속 record 감지 (RecentRecords/TrendChart 갱신) |
| 페이지 스크롤 | 잠금 안 함 (배경 흐림 처리만) |

→ **모달은 안내 layer, 측정/저장은 끊김 X**.

### 모달 닫기 경로 (a11y)

| 사용자 입력 | 동작 |
|---|---|
| "알겠어요" 클릭 | `onClose()` |
| ESC 키 | `onClose()` |
| 배경 흐림 영역 클릭 | `onClose()` |

### dismiss 후 재등장 조건

| 시나리오 | 모달 재등장? |
|---|---|
| 같은 세션 (브라우저 탭 그대로) | ❌ |
| 새 세션 (브라우저 닫고 다시) | ✅ (sessionStorage clear) |
| 자정 넘어감 (today 변경) | ✅ (key 변경 → dismissed=false) |
| 같은 날 risk가 더 악화 (caution → warning, negative 증가 등) | ❌ (그날 1회 한정 — 사용자 통제권 존중) |

### sessionStorage 정책

```
key:    onmaum-warning-dismissed-2026-04-27
value:  'true' (있음) / null (없음)
```

- **sessionStorage 사용 이유**: 새 세션마다 다시 보임 = 안전망 적합 (위급 시 잘 보이도록)
- **localStorage 안 쓰는 이유**: 한 번 dismiss 후 영구히 안 보이면 안전망 약화. 또한 여러 탭 동기화는 의도된 trade-off X (탭별 독립 = 사용자 통제권)

### SelfCareTip 회전 정책

```
페이지 진입 → selectRandomTip()                       (current=undefined → 완전 랜덤)
🔄 클릭   → selectRandomTip(current)                  (current=현재 → 다른 tip)
🔄 다시   → selectRandomTip(current=2nd)              (계속 다른 것)
모든 tip 한 번씩 본 후 → 다시 랜덤 (현재 tip만 제외)
```

## 5. Error Handling

| # | 케이스 | 처리 |
|---|---|---|
| 1 | sessionStorage 접근 실패 | `try/catch` → 읽기 실패 시 `dismissed=false` (안전 측), 쓰기 실패 시 console.error만. 사용자 알림 X |
| 2 | useLiveQuery 실패 | `todayRecords === undefined` 동안 `todayRisk = null` → `showWarning = false` (Step 3 패턴) |
| 3 | record 없음 (aggregateDailyRisk null) | `showWarning = false` → 모달 안 뜸. **의도대로** |
| 4 | tel: 링크 OS별 차이 | 모바일 자동 호출 / 데스크톱 일부 미동작. 그래도 숫자 텍스트 노출 → 사용자 직접 dial 가능. 별도 처리 X |
| 5 | TIPS 빈 리스트 | 컴파일 시점 보장 (정적 const, 항상 ≥1개). fallback 불필요 |
| 6 | TIPS 길이 1일 때 selectRandomTip(only) | 같은 tip 반환 (회전 불가). 코드 약속: TIPS ≥ 2개 |

### UI 표시 정책

- Step 6 에러는 사용자에게 **노출 안 함** (안전망의 안전망까지 표시하면 알림 피로)
- 모든 에러는 console.error 로그만

## 6. Testing

### 도구
이미 셋업됨 (Step 3): Vitest + happy-dom + @testing-library/react + fake-indexeddb. 추가 설치 없음.

### 모듈별 강도

| 모듈 | TDD 강도 | 비고 |
|---|---|---|
| `lib/selfCareTips.ts` | **엄격** | 순수 함수, 입출력 명확 |
| `hooks/useWarningDismissal.ts` | 적용 | sessionStorage mock, hook test |
| `RiskWarningModal.tsx` | best effort | UI behavior |
| `ContactsFooter.tsx` | minimal | 텍스트 노출 + tel: 링크 |
| `SelfCareTip.tsx` | best effort | UI + state interaction |

### 핵심 테스트 케이스

**`selfCareTips`:**
- TIPS 최소 5개 이상
- selectRandomTip() → TIPS 안의 tip
- selectRandomTip(currentTip) → currentTip과 다른 tip
- 여러 번 호출해도 항상 currentTip이 아닌 것

**`useWarningDismissal`:**
- 초기 dismissed=false
- dismiss() → dismissed=true 변경 + sessionStorage 저장
- 같은 date 재마운트 → dismissed=true 유지
- 다른 date → dismissed=false (key 다름)

**`RiskWarningModal`:**
- open=true → 모달 렌더, 카피/연락처/버튼 보임
- open=false → null 반환
- "알겠어요" 클릭 → onClose 호출
- 연락처 tel: 링크 attribute 정확

**`ContactsFooter`:**
- 1577-0199, 1393 텍스트 노출
- tel: 링크 attribute 정확

**`SelfCareTip`:**
- 초기 tip 표시
- 🔄 클릭 → 다른 tip 교체

### 의도적으로 skip할 가능성

- ESC 키 / 배경 클릭 모달 닫기 — UI library 없이 직접 구현 시 테스트 복잡 → best effort
- sessionStorage 접근 실패 — mock 복잡 → skip 또는 best effort

### 통합 검증
- TDD 후 `app/page.tsx` 통합 → 브라우저 수동 검증
- 시나리오:
  1. record 0개 → 모달 안 뜸, ContactsFooter 보임, SelfCareTip 보임
  2. 측정으로 warning 만들기 → 모달 자동 등장
  3. "알겠어요" 클릭 → 닫힘
  4. 새로고침 → dismissed 유지 (모달 안 뜸)
  5. 새 탭에서 같은 페이지 → 다른 sessionStorage라 모달 다시 등장 (의도)

## 7. 다음 단계 연결

### Implementation 단계 (writing-plans)
- 본 스펙 승인 후 `superpowers:writing-plans` 스킬 invoke → implementation plan 작성
- TDD 흐름으로 모듈 단위 구현
- 각 모듈 완료 시점에 `superpowers:verification-before-completion` 적용

### Step 7 (로컬 알림) 진입 시 검토 사항
- Step 6 모달은 "페이지 진입 시" 트리거 — Step 7은 "백그라운드/알림" 트리거 (Notifications API)
- ContactsFooter는 그대로 유지 — 알림 클릭 시 페이지 진입하면 다시 보임
- 알림 권한 요청 UX 결정 필요 (페이지 진입 시 즉시 vs 사용자 토글)

### 메모리 참조
- `feedback_collaborative_pacing.md` — 협업 페이싱
- `feedback_skill_invocation.md` — TDD/verification 명시 적용
- `project_step4_anger_compensation.md` — 화남 보정 (Step 4에서 이미 적용 완료)
