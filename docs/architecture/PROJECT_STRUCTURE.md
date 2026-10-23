# ONMAUM 프로젝트 구조

2026-10-07 공식 6개 업무에 맞춘 구조다. 재분류 당시 기준 커밋은 `c39be13`, 작업 브랜치는 `chore/reclassify-by-role`이었으며 현재 `main`에 포함되어 있다. 2026-10-18 역할 명칭 개정(③ 개인 데이터 관리, ① 카메라·rPPG 등)은 [CODE_OWNERSHIP.md](../collaboration/CODE_OWNERSHIP.md)를 따른다. 직전 UI/Core 계층 분류에서 실제 파일 내용을 다시 읽고 이동했다. 기존 2026-10-06 분류·검증 기록은 기준 커밋의 이 문서에서 확인할 수 있다.

소유권과 공동 경계는 [CODE_OWNERSHIP.md](../collaboration/CODE_OWNERSHIP.md), 범위·검증은 [ROLE_RECLASSIFICATION.md](../collaboration/ROLE_RECLASSIFICATION.md), 설치·인계는 [ORCA_WORKFLOW.md](../collaboration/ORCA_WORKFLOW.md)를 따른다.

## 업무별 책임

| 파일/디렉터리 | 담당 | 업무번호 | 이유 |
|---|---|---|---|
| `features/camera/**`, `public/models/**` | 김우빈 | ① | 카메라·검출·모델·측정 루프 (`useEmotionRecorder`는 공동) |
| 향후 `features/rppg/` — 현재 미생성 | 김우빈 | ① | RGB 시계열 수집·rPPG 신호처리·BPM 추정·측정 품질 판정 |
| 향후 `features/electron/` — 현재 미생성 | 김우빈 | ② | Electron 실행 환경·main·preload·IPC·창 |
| `shared/storage/**` 중심 (내보내기·삭제 위치는 구현 시 결정) | 이정환 | ③ | 세션·측정 기록 저장·데이터 내보내기·삭제·개인 통계 데이터 |
| `features/ui/**` | 김우빈 | ④ | 화면·오브·시각 표현·Document PiP |
| `features/algorithm/**` | 이정환 | ⑤ | 정규화·감정 집계·스트레스·기준선·보정 |
| `features/feedback/{lib,hooks}/**` | 이정환 | ⑥ | 체크인·넛지·알림·문구·자기관리 제안 |
| `features/feedback/components/**` | 공동 (조건·문구 이정환, 시각 디자인 김우빈) | ⑥ / ④ | 체크인·넛지 컴포넌트 |
| `shared/storage/**` | 공동 / 이정환 중심 | Shared | DB·CRUD·프로필·설정·일일 상태 |
| `app/**` | 김우빈 / 통합 공동 | ④ / Shared | framework routing·기능 조합 |
| `tests/<업무>/**` | 대응 소스 담당 | 동일 | 소스와 대응하는 테스트 |
| `tests/tooling/**`, 설정·협업 문서 | 공동 | Shared | 작업 환경·CI·협업 기준 |

## 실제 파일 트리 (Git에 포함되는 경로)

미구현 rPPG/Electron 폴더, 중복 types, 빈 constants/utils 폴더를 만들지 않았다. tests는 업무명 아래 소스 구조를 따른다. 테스트가 없는 기능을 위해 빈 폴더를 만들지 않는다.

```text
app/
├── demo/
│   └── page.tsx
├── measure/
│   └── page.tsx
├── orb-preview/
│   └── page.tsx
├── stats/
│   └── page.tsx
├── favicon.ico
├── globals.css
├── layout.tsx
└── page.tsx
features/
├── algorithm/
│   ├── baseline/
│   │   ├── baseline.ts
│   │   └── calibration.ts
│   ├── emotion/
│   │   ├── emotionAggregator.ts
│   │   └── emotionAnalysis.ts
│   └── stress/
│       ├── dailyStress.ts
│       ├── riskCalculator.ts
│       └── stressIndex.ts
├── camera/
│   ├── components/
│   │   └── CameraView.tsx
│   ├── hooks/
│   │   └── useEmotionRecorder.ts
│   └── lib/
│       └── faceDetection.ts
├── feedback/
│   ├── components/
│   │   ├── CheckInCard.tsx
│   │   ├── NudgeBanner.tsx
│   │   ├── NudgeHost.tsx
│   │   ├── NudgeSettings.tsx
│   │   └── RiskAlert.tsx
│   ├── hooks/
│   │   ├── useCheckin.ts
│   │   ├── useNotificationPermission.ts
│   │   └── useNudge.ts
│   └── lib/
│       ├── checkin.ts
│       ├── checkinCopy.ts
│       ├── notification.ts
│       ├── nudge.ts
│       └── selfCareSuggestion.ts
└── ui/
    ├── common/
    │   ├── AppChrome.tsx
    │   ├── ContactsFooter.tsx
    │   ├── Navigation.tsx
    │   └── ServiceWorkerRegistrar.tsx
    ├── hooks/
    │   ├── useOrbPip.ts
    │   └── useScrollReveal.ts
    ├── landing/
    │   ├── LandingCTA.tsx
    │   ├── LandingData.tsx
    │   ├── LandingFeatures.tsx
    │   ├── LandingFooter.tsx
    │   ├── LandingHero.tsx
    │   ├── LandingNav.tsx
    │   └── LandingRisk.tsx
    ├── measure/
    │   └── EmotionDisplay.tsx
    ├── onboarding/
    │   ├── Onboarding.tsx
    │   └── OnboardingSurvey.tsx
    ├── orb/
    │   ├── lib/
    │   │   ├── orbCaption.ts
    │   │   ├── orbColor.ts
    │   │   ├── orbMotion.ts
    │   │   ├── orbStages.ts
    │   │   └── pip.ts
    │   ├── EmotionOrb.module.css
    │   ├── EmotionOrb.tsx
    │   ├── OrbPipButton.module.css
    │   ├── OrbPipButton.tsx
    │   └── ReactiveOrb.tsx
    └── report/
        ├── DailyReport.tsx
        ├── RecentRecords.tsx
        └── TrendChart.tsx
shared/
└── storage/
    ├── dayState.ts
    ├── db.ts
    ├── emotionRepository.ts
    ├── profile.ts
    └── settings.ts
tests/
├── algorithm/
│   ├── baseline/
│   │   ├── baseline.test.ts
│   │   └── calibration.test.ts
│   ├── emotion/
│   │   ├── emotionAggregator.test.ts
│   │   └── emotionAnalysis.test.ts
│   └── stress/
│       ├── dailyStress.test.ts
│       ├── riskCalculator.test.ts
│       └── stressIndex.test.ts
├── camera/
│   └── hooks/
│       └── useEmotionRecorder.test.tsx
├── feedback/
│   ├── components/
│   │   ├── CheckInCard.test.tsx
│   │   ├── NudgeBanner.test.tsx
│   │   └── NudgeSettings.test.tsx
│   ├── hooks/
│   │   ├── useCheckin.test.tsx
│   │   ├── useNotificationPermission.test.tsx
│   │   └── useNudge.test.tsx
│   └── lib/
│       ├── checkin.test.ts
│       ├── checkinCopy.test.ts
│       ├── nudge.test.ts
│       └── selfCareSuggestion.test.ts
├── shared/
│   └── storage/
│       ├── dayState.test.ts
│       ├── emotionRepository.test.ts
│       ├── profile.test.ts
│       └── settings.test.ts
├── tooling/
│   └── runner.test.mjs
├── ui/
│   ├── common/
│   │   └── ContactsFooter.test.tsx
│   ├── onboarding/
│   │   └── OnboardingSurvey.test.tsx
│   ├── orb/
│   │   └── lib/
│   │       ├── orbCaption.test.ts
│   │       ├── orbColor.test.ts
│   │       ├── orbMotion.test.ts
│   │       ├── orbStages.test.ts
│   │       └── pip.test.ts
│   └── report/
│       └── DailyReport.test.tsx
└── setup.ts
```

`docs/`는 architecture·collaboration·superpowers/plans·superpowers/specs·roadmap·학기 기록을 담는다. `public/`의 모델 4종 manifest/5개 shard, SVG·manifest·서비스 워커는 기존 위치와 바이트를 유지한다. PWA 공개 URL과 모든 app route를 유지한다.

## 데이터 흐름과 경계

`CameraView → faceDetection(Detection → RawExpressions) → normalizeExpressions → EmotionResult → useEmotionRecorder → aggregate → shared/storage`가 측정·저장 흐름이다. 조회한 기록으로 Algorithm이 Stress/State/Baseline을 계산하고, Feedback이 조건·문구를 선택하며 UI가 표시한다.

카메라 어댑터의 `analyzeEmotion(videoEl): Promise<EmotionResult | null>` 반환값은 기존과 동일한 **정규화 결과**다. raw 경계는 `normalizeExpressions(detection.expressions)` 호출이다. `RawExpressions`, `EmotionResult`, `Emotion` 타입은 `features/algorithm/emotion/emotionAnalysis.ts`에 기존 정의를 유지했다.

`useEmotionRecorder`는 camera의 통합 훅으로 500ms 분석·60000ms 집계와 저장을 연결한다. 집계·저장 계약은 공동 검토한다. `DailyReport`의 기존 평균 함수·알고리즘 호출과 `app/measure`, `app/stats`의 기능 조합은 그대로 두었다. UI에서 계산 의미를 변경할 때는 알고리즘 담당이 함께 검토한다.

알고리즘은 camera·UI·hooks를 import하지 않는다. 저장 계층이 참조하는 감정/피드백 타입과 알고리즘이 참조하는 저장 record 타입은 type-only로 유지한다. 새 런타임 순환 참조를 만들지 않는다. 오브 표현·브라우저 PiP는 UI이며 Electron 구현으로 분류하지 않는다.

## 변경 범위와 보존 사항

- 실제 파일 86개 이동, 혼합 파일에서 카메라 어댑터 1개 추출. 추가 기능·타입 중복·barrel export 없음.
- 선언 추출 외 TS/TSX 변경은 import·mock 경로뿐이다. 계산식·타입·함수 본문·props·테스트 기대값·skip 4개 유지.
- CSS Modules는 컴포넌트와 함께 이동했고 스타일 내용·UI 문구·레이아웃·애니메이션을 유지했다.
- `dayState`는 계산 코드가 아니라 체크인·넛지 localStorage read/write다. `emotionRepository`는 순수 Dexie CRUD이므로 둘 다 shared/storage다.
- `RiskAlert.tsx`, `notification.ts`는 0바이트 그대로 feedback에 이동했다.
- 모델 URL `/models`, confidence 0.5, 세 모델 로딩, getUserMedia 옵션, 감정 공식, DB명/version/schema, 저장 키, 의존성·설정 유지.
- 공통 수정은 route/layout import, AGENTS/README/구조·소유권·협업 문서, Issue/PR 양식이다. package/lock/전역 CSS/설정 파일은 변경하지 않는다.
- 과거 설계·계획은 현존 모듈 경로만 갱신했다. 폐기된 기능·옛 동작·체크리스트는 역사 기록이며 현재 실행 지침이 아니다. 아래 OLD 열은 이동 이력이다.

## 전체 이동 경로

### algorithm (7개)

| OLD | NEW |
|---|---|
| `lib/emotion/emotionAnalysis.ts` | `features/algorithm/emotion/emotionAnalysis.ts` |
| `lib/emotion/emotionAggregator.ts` | `features/algorithm/emotion/emotionAggregator.ts` |
| `lib/stress/stressIndex.ts` | `features/algorithm/stress/stressIndex.ts` |
| `lib/stress/dailyStress.ts` | `features/algorithm/stress/dailyStress.ts` |
| `lib/stress/riskCalculator.ts` | `features/algorithm/stress/riskCalculator.ts` |
| `lib/stress/baseline.ts` | `features/algorithm/baseline/baseline.ts` |
| `lib/stress/calibration.ts` | `features/algorithm/baseline/calibration.ts` |

### camera (2개)

| OLD | NEW |
|---|---|
| `components/measure/CameraView.tsx` | `features/camera/components/CameraView.tsx` |
| `hooks/emotion/useEmotionRecorder.ts` | `features/camera/hooks/useEmotionRecorder.ts` |

### feedback (13개)

| OLD | NEW |
|---|---|
| `components/report/CheckInCard.tsx` | `features/feedback/components/CheckInCard.tsx` |
| `components/nudge/NudgeBanner.tsx` | `features/feedback/components/NudgeBanner.tsx` |
| `components/nudge/NudgeHost.tsx` | `features/feedback/components/NudgeHost.tsx` |
| `components/nudge/NudgeSettings.tsx` | `features/feedback/components/NudgeSettings.tsx` |
| `components/RiskAlert.tsx` | `features/feedback/components/RiskAlert.tsx` |
| `hooks/checkin/useCheckin.ts` | `features/feedback/hooks/useCheckin.ts` |
| `hooks/nudge/useNudge.ts` | `features/feedback/hooks/useNudge.ts` |
| `hooks/nudge/useNotificationPermission.ts` | `features/feedback/hooks/useNotificationPermission.ts` |
| `lib/checkin/checkin.ts` | `features/feedback/lib/checkin.ts` |
| `lib/checkin/checkinCopy.ts` | `features/feedback/lib/checkinCopy.ts` |
| `lib/nudge/nudge.ts` | `features/feedback/lib/nudge.ts` |
| `lib/emotion/selfCareSuggestion.ts` | `features/feedback/lib/selfCareSuggestion.ts` |
| `lib/notification.ts` | `features/feedback/lib/notification.ts` |

### ui (29개)

| OLD | NEW |
|---|---|
| `components/common/AppChrome.tsx` | `features/ui/common/AppChrome.tsx` |
| `components/common/ContactsFooter.tsx` | `features/ui/common/ContactsFooter.tsx` |
| `components/common/Navigation.tsx` | `features/ui/common/Navigation.tsx` |
| `components/common/ServiceWorkerRegistrar.tsx` | `features/ui/common/ServiceWorkerRegistrar.tsx` |
| `components/landing/LandingCTA.tsx` | `features/ui/landing/LandingCTA.tsx` |
| `components/landing/LandingData.tsx` | `features/ui/landing/LandingData.tsx` |
| `components/landing/LandingFeatures.tsx` | `features/ui/landing/LandingFeatures.tsx` |
| `components/landing/LandingFooter.tsx` | `features/ui/landing/LandingFooter.tsx` |
| `components/landing/LandingHero.tsx` | `features/ui/landing/LandingHero.tsx` |
| `components/landing/LandingNav.tsx` | `features/ui/landing/LandingNav.tsx` |
| `components/landing/LandingRisk.tsx` | `features/ui/landing/LandingRisk.tsx` |
| `components/measure/EmotionDisplay.tsx` | `features/ui/measure/EmotionDisplay.tsx` |
| `components/onboarding/Onboarding.tsx` | `features/ui/onboarding/Onboarding.tsx` |
| `components/onboarding/OnboardingSurvey.tsx` | `features/ui/onboarding/OnboardingSurvey.tsx` |
| `components/orb/EmotionOrb.module.css` | `features/ui/orb/EmotionOrb.module.css` |
| `components/orb/EmotionOrb.tsx` | `features/ui/orb/EmotionOrb.tsx` |
| `components/orb/OrbPipButton.module.css` | `features/ui/orb/OrbPipButton.module.css` |
| `components/orb/OrbPipButton.tsx` | `features/ui/orb/OrbPipButton.tsx` |
| `components/orb/ReactiveOrb.tsx` | `features/ui/orb/ReactiveOrb.tsx` |
| `components/report/DailyReport.tsx` | `features/ui/report/DailyReport.tsx` |
| `components/report/RecentRecords.tsx` | `features/ui/report/RecentRecords.tsx` |
| `components/report/TrendChart.tsx` | `features/ui/report/TrendChart.tsx` |
| `hooks/ui/useOrbPip.ts` | `features/ui/hooks/useOrbPip.ts` |
| `hooks/ui/useScrollReveal.ts` | `features/ui/hooks/useScrollReveal.ts` |
| `lib/orb/orbCaption.ts` | `features/ui/orb/lib/orbCaption.ts` |
| `lib/orb/orbColor.ts` | `features/ui/orb/lib/orbColor.ts` |
| `lib/orb/orbMotion.ts` | `features/ui/orb/lib/orbMotion.ts` |
| `lib/orb/orbStages.ts` | `features/ui/orb/lib/orbStages.ts` |
| `lib/orb/pip.ts` | `features/ui/orb/lib/pip.ts` |

### shared (5개)

| OLD | NEW |
|---|---|
| `lib/storage/dayState.ts` | `shared/storage/dayState.ts` |
| `lib/storage/db.ts` | `shared/storage/db.ts` |
| `lib/storage/profile.ts` | `shared/storage/profile.ts` |
| `lib/storage/settings.ts` | `shared/storage/settings.ts` |
| `lib/emotion/emotionRepository.ts` | `shared/storage/emotionRepository.ts` |

### tests (30개)

| OLD | NEW |
|---|---|
| `tests/components/common/ContactsFooter.test.tsx` | `tests/ui/common/ContactsFooter.test.tsx` |
| `tests/components/nudge/NudgeBanner.test.tsx` | `tests/feedback/components/NudgeBanner.test.tsx` |
| `tests/components/nudge/NudgeSettings.test.tsx` | `tests/feedback/components/NudgeSettings.test.tsx` |
| `tests/components/onboarding/OnboardingSurvey.test.tsx` | `tests/ui/onboarding/OnboardingSurvey.test.tsx` |
| `tests/components/report/CheckInCard.test.tsx` | `tests/feedback/components/CheckInCard.test.tsx` |
| `tests/components/report/DailyReport.test.tsx` | `tests/ui/report/DailyReport.test.tsx` |
| `tests/hooks/checkin/useCheckin.test.tsx` | `tests/feedback/hooks/useCheckin.test.tsx` |
| `tests/hooks/emotion/useEmotionRecorder.test.tsx` | `tests/camera/hooks/useEmotionRecorder.test.tsx` |
| `tests/hooks/nudge/useNotificationPermission.test.tsx` | `tests/feedback/hooks/useNotificationPermission.test.tsx` |
| `tests/hooks/nudge/useNudge.test.tsx` | `tests/feedback/hooks/useNudge.test.tsx` |
| `tests/lib/checkin/checkin.test.ts` | `tests/feedback/lib/checkin.test.ts` |
| `tests/lib/checkin/checkinCopy.test.ts` | `tests/feedback/lib/checkinCopy.test.ts` |
| `tests/lib/emotion/emotionAggregator.test.ts` | `tests/algorithm/emotion/emotionAggregator.test.ts` |
| `tests/lib/emotion/emotionAnalysis.test.ts` | `tests/algorithm/emotion/emotionAnalysis.test.ts` |
| `tests/lib/emotion/emotionRepository.test.ts` | `tests/shared/storage/emotionRepository.test.ts` |
| `tests/lib/emotion/selfCareSuggestion.test.ts` | `tests/feedback/lib/selfCareSuggestion.test.ts` |
| `tests/lib/nudge/nudge.test.ts` | `tests/feedback/lib/nudge.test.ts` |
| `tests/lib/orb/orbCaption.test.ts` | `tests/ui/orb/lib/orbCaption.test.ts` |
| `tests/lib/orb/orbColor.test.ts` | `tests/ui/orb/lib/orbColor.test.ts` |
| `tests/lib/orb/orbMotion.test.ts` | `tests/ui/orb/lib/orbMotion.test.ts` |
| `tests/lib/orb/orbStages.test.ts` | `tests/ui/orb/lib/orbStages.test.ts` |
| `tests/lib/orb/pip.test.ts` | `tests/ui/orb/lib/pip.test.ts` |
| `tests/lib/storage/dayState.test.ts` | `tests/shared/storage/dayState.test.ts` |
| `tests/lib/storage/profile.test.ts` | `tests/shared/storage/profile.test.ts` |
| `tests/lib/storage/settings.test.ts` | `tests/shared/storage/settings.test.ts` |
| `tests/lib/stress/baseline.test.ts` | `tests/algorithm/baseline/baseline.test.ts` |
| `tests/lib/stress/calibration.test.ts` | `tests/algorithm/baseline/calibration.test.ts` |
| `tests/lib/stress/dailyStress.test.ts` | `tests/algorithm/stress/dailyStress.test.ts` |
| `tests/lib/stress/riskCalculator.test.ts` | `tests/algorithm/stress/riskCalculator.test.ts` |
| `tests/lib/stress/stressIndex.test.ts` | `tests/algorithm/stress/stressIndex.test.ts` |

### 기존 선언 분리 (파일 이동 수와 별도)

| OLD 선언 위치 | NEW 선언 위치 |
|---|---|
| `lib/emotion/emotionAnalysis.ts`의 face-api import·모델 상수·loadFaceApiModels·analyzeEmotion | `features/camera/lib/faceDetection.ts` |

나머지 emotionAnalysis 타입·상수·normalizeExpressions·getDominantEmotion은 위 algorithm 이동 경로에 있다. 함수 인자·반환값과 본문은 그대로다.
