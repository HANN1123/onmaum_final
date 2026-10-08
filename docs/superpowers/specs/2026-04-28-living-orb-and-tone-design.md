# Living Orb + 톤 통합 설계

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

- **작성일**: 2026-04-28
- **대상**: 랜딩(`/`) + 앱(`/measure`, `/stats`) 시각 톤 통합 + Living Orb 도입
- **선행**: Step 1~8 + 랜딩 페이지 (모두 완료)
- **상태**: Draft (사용자 리뷰 대기)

## 1. 목적과 범위

### 목적
1. 랜딩과 앱이 "**같은 제품**"으로 느껴지도록 시각·타이포·모션 언어를 통일.
2. 시간이 쌓일수록 자라나는 **"내 구"(Living Orb)**를 도입해 사용자에게 정체성·소유감 부여.
3. 감정노동자가 "자기 시간을 알아가는 존재"를 갖도록.

### 도덕적 책임 (감정노동자 타깃)
- "오늘 너 위험"식의 **진단 톤 금지**. 대신 **"이번 주 힘드셨네요"식 인정 톤**.
- 색·구의 변화는 사용자 자신의 데이터 누적이지 외부 판정이 아님.
- 직장 노출/야간 근무 컨텍스트를 위해 **다크/라이트/자동** 3가지 모드 제공.
- 단계 변화 알림은 격려이지 압박이 아님 (옵트아웃 가능, 그날 1회).

### In Scope (이번 spec)
- **Living Orb 컴포넌트** — 5단계 성장, 4축 시각 분리, CSS+SVG 기반
- **단계 전환 알림** — Empty→Awakening 등 milestone에 부드러운 toast/알림
- **빈/잠긴 상태 처리** — 첫 측정 전, 2주 미측정, 데이터 삭제 후, 계산 오류 fallback
- **테마 시스템** — `dark` / `light` / `auto` 3가지 모드 + 토글 UI
- **공통 디자인 언어 통일 (C-full)** — 타이포·라벨·강조색·이모지 제거·Navigation/Footer 톤 통합
- **ReactiveOrb 라이트 variant** — 라이트 모드 랜딩에서도 동작
- 위 컴포넌트들에 대한 테스트

### Out of Scope (다음 spec — "Reflection & Growth Visualization")
- Reflection View (월말 타임랩스 / 자기 회상 화면)
- "지난주의 나 vs 지금의 나" 비교 컴포넌트
- 호흡 가이드 컴포넌트 (행동 가능한 출구 — 원칙 5)
- 익명 커뮤니티 / 감정노동자 전용 상담 안내 (원칙 5)
- 주간/월간 패턴 시각화 강화 (원칙 4 — TrendChart 재설계)

## 2. 결정 사항 요약 (브레인스토밍 합의)

| # | 항목 | 결정 |
|---|---|---|
| 1 | **통합 방향** | C — 공통 디자인 언어 + 페이지별 색 모드 분리(폐기) → 통합 테마 시스템 |
| 2 | **색감 개념** | "데이터가 디자인이 된다" — 진단이 아닌 인정 톤. 일별 → **주간 누적** |
| 3 | **위치 (B 안)** | 배경 결 + 우상단 작은 구 → **Living Orb로 진화** |
| 4 | **Living Orb 등장 위치** | (3) 모든 페이지 우상단 같은 자리 — "내 구가 따라다닌다" |
| 5 | **랜딩 hero ReactiveOrb** | (가) 유지. ReactiveOrb=마케팅 첫인상 / Living Orb=사용자 정체성, 역할 분리 |
| 6 | **테마 모드** | dark / light / **auto**(06:00~18:00 light, 18:00~06:00 dark) — 기본값 auto |
| 7 | **공통 디자인 언어 범위** | C-full — Navigation/ContactsFooter까지 톤 통일 |
| 8 | **이번 spec 범위** | (b) Living Orb 본체 + 단계 전환 알림. Reflection/비교는 다음 spec |
| 9 | **기술 스택** | CSS + SVG + CSS Variables + transition. Three.js·복잡한 Canvas 피하기 |

## 3. 5가지 디자인 원칙

1. **Emotional Tint = 인정 톤** — 페이지 색감과 구의 시각이 사용자의 누적 마음 상태를 반영. 일별이 아닌 **주간 누적**으로 톤 다운, "이번 주 힘드셨네요"의 분위기.
2. **공통 언어 + 통합 테마** — 타이포·라벨·여백·모션·강조색은 모든 페이지 통일. 다크/라이트/auto 3가지 모드를 모든 페이지가 공유 (페이지별 색 분리는 폐기).
3. **절제된 표현** — 색은 배경 그라디언트 + Living Orb에만. 카드·버튼·본문 색은 평소대로. 위험 신호는 모달이 담당.
4. **Living Orb = 자기 시간을 알아가는 존재** — 시간이 쌓일수록 빈 구에서 자기 결이 새겨진 구로 자라남. 5단계 + 4축. (이전 원칙 4 "소진 누적 추적"이 자연스럽게 흡수됨.)
5. **(다음 spec) 행동 가능한 출구** — Reflection View·호흡 가이드·커뮤니티 연결. 이번 spec에는 미포함.

## 4. Living Orb

### 4.1 5단계 성장

| 단계 | 조건 (record 개수) | 시각 표현 | 메시지 |
|---|---|---|---|
| 0. **Empty** | 0 | 거의 투명, 윤곽선만 희미 (1px stroke, opacity 0.15) | "아직 당신을 모릅니다" |
| 1. **Awakening** | 1~3 | 옅은 안개색, 약하게 흔들림 (motion 0.3) | "조금씩 느껴지기 시작" |
| 2. **Forming** | 4~10 | 색이 또렷해지지만 경계 흐림 (saturation 0.4, blur 1px) | "당신의 결이 보이기 시작" |
| 3. **Settled** | 11~30 | 또렷한 색, 부드러운 곡률 (saturation 0.7, motion 0.6) | "당신의 결이 분명해집니다" |
| 4. **Living** | 30+ | 시간대·요일에 따라 미묘하게 변화하는 살아있는 구 | "당신과 함께 살아갑니다" |

**임계값 조정 가능**: 측정 1회 = 1분 record 1개. 사용 검증 후 조정.

### 4.2 4축 시각 분리

| 축 | 변하는 기준 | 매핑 함수 | 의미 |
|---|---|---|---|
| **opacity** | 측정 누적 횟수 | `f₁(n) = 0.15 + 0.85 × log(n+1) / log(31)` (clamp 0.15~1.0) | "당신의 존재감" |
| **hue** | 주간 dominant 감정 | 4가지 색을 감정 비율로 가중 평균 (RGB 공간에서) — happy=#F2C94C, calm=#6BAB9A, sad=#7BA3C4, angry=#E8806A. 비율은 최근 7일 record의 duration 가중 평균. | "당신의 결" |
| **saturation** | 주간 감정 강도 | `intensity = max(negativeRatio, 1 - flatAffectAvg)` (0~1로 clamp), `f₃(intensity) = 0.3 + 0.7 × intensity` | "당신의 깊이" |
| **motion** | 측정 빈도 (최근 7일 측정 일수 / 7) | `f₄(freq) = 0.3 + 0.7 × log(7×freq+1) / log(8)` | "당신의 리듬" — 호흡 속도 |

**왜 로그?**: 선형은 1회→2회와 29회→30회 변화가 같음 → 초반 변화감 없음. 로그는 초반에 강하게, 후반에 미세하게.

| 측정 횟수 | 선형(linear) | **로그(log)** |
|---|---|---|
| 1회 | 0.08 | **0.25** |
| 5회 | 0.20 | **0.55** |
| 10회 | 0.35 | **0.71** |
| 20회 | 0.68 | **0.88** |
| 30회 | 1.00 | 1.00 |

### 4.3 빈/잠긴 상태 처리

| 상황 | 처리 |
|---|---|
| 첫 진입 (record=0) | Empty 단계 + "안녕하세요. 첫 측정을 시작해볼까요?" 안내 |
| 2주 이상 측정 안 함 | 구가 살짝 옅어짐 (opacity × 0.5). **stage는 그대로 유지** (한 번 도달한 단계는 잃지 않음). "당신을 기다리고 있어요" 메시지 (강요 X) |
| 데이터 삭제 후 | 빈 구로 복귀 + "리셋이 아닌 새로운 시작" 메시지 |
| 계산 오류 / DB 미가용 | Neutral fallback (회색 #A3A3A3, opacity 0.3) — 디자인이 깨진 게 보이지 않도록 |

### 4.4 단계 전환 알림 (Milestone)

- **트리거 방향**: **단계가 올라갈 때만** (Empty→Awakening, Awakening→Forming 등). 2주 미측정 fallback이나 데이터 삭제로 단계가 내려가는 건 알림 발송 안 함 (사용자에게 부담).
- **표시**: 화면 우하단에 toast 5초 fade (CSS transition). 한 단계당 평생 1회 (localStorage `onmaum_orb_stage_max`에 도달했던 최고 단계 저장 → 그 이상으로 갈 때만 알림).
- **메시지**: "당신의 구가 다음 단계로 들어섰습니다. *Forming* — 당신의 결이 보이기 시작"
- **브라우저 알림**: 옵트인(`useNotificationPermission` 기존 권한) 시 toast와 함께 시스템 알림도 발송. 옵트아웃이면 toast만.
- **dismiss**: toast 클릭 시 즉시 사라짐. 자동 5초 fade도 함께.

## 5. 테마 시스템 (Dark / Light / Auto)

### 5.1 3가지 모드
| 모드 | 동작 |
|---|---|
| `light` | 항상 라이트 (#FAFAFA 베이스, #171717 글자) |
| `dark` | 항상 다크 (#050503 베이스, #F0EDE6 글자) |
| `auto` (기본값) | 06:00~17:59 → light, 18:00~05:59 → dark. 페이지 진입 시 분기, 자정 무렵 자동 전환 안 함 (다음 진입 시 반영) |

### 5.2 토글 UI
- Navigation(앱) / LandingNav(랜딩) 모두 우측에 작은 아이콘 한 개
- 클릭 시 `light → dark → auto` 순환
- 표시: 현재 모드를 ☀ / ☾ / 자동(text) 아이콘으로
- aria-label 명확히 (예: "테마 전환: 현재 자동, 클릭하면 라이트")

### 5.3 SSR/하이드레이션
- `layout.tsx`에서 `<html data-theme={resolvedTheme}>` 즉시 적용 (스크립트 inline으로 깜빡임 방지)
- localStorage `onmaum_theme` 읽고 적용
- React Context로 페이지에 전달

## 6. 공통 디자인 언어 (C-full)

### 6.1 타이포
- **헤딩**: `font-thin` (100) 또는 `font-light` (300). 현재 앱의 `font-semibold` (600) 폐기.
- **본문**: `font-light` (300)
- **레터스페이싱**: 헤딩 `tracking-[-0.04em]`, 라벨 `tracking-[0.18em] uppercase`

### 6.2 라벨 패턴
랜딩 hero에서 쓰는 `— 마음 상태 모니터링` 패턴을 모든 페이지 헤더에 적용:
- `/measure` → `— 측정`
- `/stats` → `— 통계`
- 단계 전환 toast → `— FORMING`

### 6.3 강조색 통일
모든 페이지의 primary 강조색은 **#6BAB9A** 한 가지. caution(#D4A84B)·warning(#E8806A)는 위험 표시 전용.

### 6.4 이모지 제거
앱의 상태 메시지에서 ⏳/❌/✅ 모두 제거 → 부드러운 텍스트로:
- ⏳ "face-api 모델 로딩 중..." → "모델을 불러오고 있습니다"
- ❌ "모델 로드 실패" → "모델을 불러오지 못했습니다"
- ✅ console 로그도 정리

### 6.5 Navigation / Footer 톤 통일
- `LandingNav`와 `Navigation`을 같은 시각 시스템에서 파생 (높이·로고·링크 스타일 통일)
- `LandingFooter`와 `ContactsFooter`도 동일
- 단, 랜딩만의 nav 링크 (#features 등)는 랜딩에만, 앱의 측정/통계 탭은 앱에만 — 컨텐츠는 다르되 시각 언어는 같음

## 7. 적용 범위

### 7.1 페이지별

| 페이지 | 변경 |
|---|---|
| `/` 랜딩 | 테마 따라 light/dark. 다크: 현재 톤 유지. **라이트: 새로 그림** (베이지 베이스 + 청록 강조). ReactiveOrb 라이트 variant 추가. 우상단 Living Orb 추가 |
| `/measure` | 테마 따라. 다크 톤 새로 그림. 우상단 Living Orb 추가. 이모지 제거. 헤더에 `— 측정` 라벨 |
| `/stats` | 테마 따라. 다크 톤 새로 그림. 우상단 Living Orb 추가. 헤더에 `— 통계` 라벨 |

### 7.2 컴포넌트별 변경 목록

**새로 만듦** (~6개):
- `LivingOrb.tsx` — SVG 기반 구 컴포넌트 (props: stage, hue, saturation, opacity, motion, theme)
- `ThemeToggle.tsx` — 3-mode 토글 버튼
- `MilestoneToast.tsx` — 단계 전환 toast
- `features/ui/orb/lib/orbStages.ts` — 5단계 정의 + 임계값
- `lib/orbAxes.ts` — 4축 매핑 함수 (순수 함수, TDD)
- `hooks/useTheme.ts` — 테마 상태 관리
- `hooks/useLivingOrb.ts` — 4축 실시간 계산 (record 개수 + 주간 감정 + 빈도)
- `hooks/useMilestone.ts` — 단계 변화 감지 + toast/알림 트리거

**수정** (~12개):
- `app/globals.css` — 다크/라이트 토큰 둘 다, CSS variables (`--tint-rgb`, `--bg-base` 등)
- `app/layout.tsx` — `<html data-theme>` 적용, ThemeProvider, LivingOrbProvider, MilestoneToast 호스트
- `app/page.tsx` (랜딩) — useScrollReveal과 함께 ThemeProvider 활용
- `app/measure/page.tsx` — 헤더 라벨 패턴, 이모지 제거, 다크 톤 대응
- `app/stats/page.tsx` — 동일
- `features/ui/landing/LandingNav.tsx` — ThemeToggle 통합, 다크/라이트 양쪽 지원
- `features/ui/common/Navigation.tsx` — LandingNav와 톤 통일, ThemeToggle 통합
- `features/ui/landing/LandingFooter.tsx` + `ContactsFooter.tsx` — 톤 통일
- `features/ui/orb/ReactiveOrb.tsx` — 라이트 variant 추가 (color props 또는 theme context)
- `features/ui/measure/EmotionDisplay.tsx`, `DailyRiskCard.tsx`, `TrendChart.tsx`, `RecentRecords.tsx`, `SelfCareTip.tsx` — 다크 톤 대응 + 타이포 통일
- `features/camera/hooks/useEmotionRecorder.ts` — 변경 없음 (기존 그대로)

**그대로**:
- `RiskWarningModal`, `useWarningDismissal`, `useNotificationPermission`, `useRiskNotification`, `riskCalculator`, `emotionRepository`, `db`, `selfCareTips`

## 8. 데이터 흐름 + 기술 결정

### 8.1 Context 구조
```
<ThemeProvider>          // resolves dark/light, sets data-theme
  <LivingOrbProvider>    // computes 4 axes from DB + active emotion
    <MilestoneProvider>  // detects stage transitions, triggers toast
      <App />
```

### 8.2 hook 인터페이스
```ts
useTheme(): {
  theme: 'dark' | 'light' | 'auto'
  resolvedTheme: 'dark' | 'light'
  setTheme(next): void
}

useLivingOrb(): {
  stage: 'empty' | 'awakening' | 'forming' | 'settled' | 'living'
  axes: {
    opacity: number    // 0.15~1.0
    hue: string        // hex
    saturation: number // 0.3~1.0
    motion: number     // 0.3~1.0
  }
  fallback: 'idle' | 'inactive2w' | 'error' | null
}

useMilestone(currentStage): {
  // 내부적으로 localStorage 비교, 변화 감지 시 toast
}
```

### 8.3 CSS variables (globals.css)
```css
:root[data-theme="light"] {
  --bg-base: #FAFAFA;
  --bg-tint: rgba(107,171,154,0.05);
  --fg: #171717;
  --fg-muted: #737373;
  --accent: #6BAB9A;
}
:root[data-theme="dark"] {
  --bg-base: #050503;
  --bg-tint: rgba(107,171,154,0.06);
  --fg: #F0EDE6;
  --fg-muted: rgba(240,237,230,0.4);
  --accent: #6BAB9A;
}
```

### 8.4 Living Orb SVG 구조
- `<svg>` 내부 `<defs>` + `<radialGradient>` + `<filter>` (blur for forming stage)
- CSS `@keyframes orbBreathe` — motion 축에 따라 duration 변경
- `prefers-reduced-motion: reduce` 시 모션 정지

## 9. 테스트 전략

### 9.1 순수 함수 (TDD)
- `features/ui/orb/lib/orbStages.ts` — recordCount → stage 매핑 (경계값 0/1/3/4/10/11/30/31)
- `lib/orbAxes.ts`:
  - `opacityFromCount(n)` — 0=0.15, 31=1.0, log 곡선
  - `hueFromWeeklyEmotion(emotions)` — dominant 가중 평균
  - `saturationFromIntensity(...)` — 0.3~1.0 clamp
  - `motionFromFrequency(daysOutOf7)` — 0/1/3/5/7 케이스
- `aggregateWeeklyEmotion(records, endDate)` — 7일 집계, edge cases

### 9.2 Hook
- `useTheme` — light→dark→auto 순환, localStorage 저장/복원, auto 모드 시간대 분기
- `useLivingOrb` — DB 변경 시 axes 재계산, 측정 active 시 hue 즉시 반영, 2주 미측정 fallback
- `useMilestone` — 단계 변화 감지, 같은 단계 재진입은 trigger 안 함

### 9.3 컴포넌트
- `LivingOrb` — props 변화에 SVG 속성 반영, 5단계 각각 시각 회귀 (스크린샷 대신 attribute 검증)
- `ThemeToggle` — 클릭 순환, aria-label, 키보드 접근성
- `MilestoneToast` — 표시/사라짐, 메시지 매핑

### 9.4 통합
- 랜딩 → 측정 → 통계 페이지 이동 시 Living Orb 위치 유지
- 테마 토글 시 모든 페이지 동시 반영
- 측정 시작/종료 시 hue 전환 부드러움

## 10. 작업 추정

총 **약 5.5~9시간**.

| 항목 | 추정 |
|---|---|
| 테마 시스템 (토큰, 토글, SSR) | 40~60분 |
| 4축 매핑 함수 + 5단계 정의 (TDD) | 30~45분 |
| useTheme / useLivingOrb / useMilestone | 60~90분 |
| LivingOrb SVG 컴포넌트 (5단계) | 90~120분 |
| ReactiveOrb 라이트 variant | 20~30분 |
| 단계 전환 toast | 30~45분 |
| 빈/잠긴 상태 처리 | 20~30분 |
| C-full 통일 (Navigation/Footer/카드 톤·타이포·이모지 제거) | 60~90분 |
| 통합 디버깅 + 브라우저 검증 | 40~60분 |

## 11. 다음 단계

이 spec 승인 후:
1. `superpowers:writing-plans` skill로 implementation plan 생성
2. plan을 `docs/superpowers/plans/2026-04-29-living-orb-and-tone-plan.md`에 저장
3. 커밋 후 다음 세션에서 구현 시작 (TDD)
