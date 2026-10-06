# 온마음 프로젝트 구조

기준: [woobin-01/onmaum](https://github.com/woobin-01/onmaum) main의 커밋 `294ee8a`. 도메인별 소유권은 [CODE_OWNERSHIP.md](../collaboration/CODE_OWNERSHIP.md)를 따릅니다.

## 분류 목적과 판단

기존에는 서로 다른 기능의 파일이 `components/`, `hooks/`, `lib/`에 평면적으로 모여 있어 UI와 Core의 담당 경계, 관련 테스트 위치를 파악하기 어려웠습니다. 기존 계층과 파일명을 유지하면서 각 계층 아래 기능별 폴더를 추가했습니다.

- `components/`: 화면과 사용자 상호작용. 측정 UI는 `measure`, 체크인 카드는 이를 표시하는 `report`에 둡니다.
- `hooks/`: 분석·체크인·넛지의 실행 흐름과 UI 생명주기. PiP와 스크롤 훅은 `ui`로 묶습니다.
- `lib/emotion/`: 분석, 집계, 기록 저장·조회와 감정·프로필 기반 회복 제안. `selfCareSuggestion.ts`는 스트레스 계산식이 아니므로 이곳에 둡니다.
- `lib/stress/`: 스트레스 계산, 일별 집계, 기준선, 자기보고 보정과 계산 가중치.
- `lib/storage/`: IndexedDB와 localStorage. `dayState.ts`는 체크인·넛지의 일별 상태를 저장하므로 계산 영역에서 분리합니다.
- `lib/checkin/`, `lib/nudge/`: 각 기능의 판정 규칙과 카피. 알림 실행은 기존대로 `hooks/nudge/useNudge.ts`에 있습니다.
- `lib/orb/`: 색상, 모션, 문구, 시각적 성장과 PiP 지원 확인. 순수 함수지만 표현 책임이므로 UI 담당입니다.
- 테스트는 소스와 같은 도메인을 사용하고, 테스트가 없는 영역에 빈 폴더를 추가하지 않습니다.

## 최종 소스와 테스트 구조

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
components/
├── common/
│   ├── AppChrome.tsx
│   ├── ContactsFooter.tsx
│   ├── Navigation.tsx
│   └── ServiceWorkerRegistrar.tsx
├── landing/
│   ├── LandingCTA.tsx
│   ├── LandingData.tsx
│   ├── LandingFeatures.tsx
│   ├── LandingFooter.tsx
│   ├── LandingHero.tsx
│   ├── LandingNav.tsx
│   └── LandingRisk.tsx
├── measure/
│   ├── CameraView.tsx
│   └── EmotionDisplay.tsx
├── nudge/
│   ├── NudgeBanner.tsx
│   ├── NudgeHost.tsx
│   └── NudgeSettings.tsx
├── onboarding/
│   ├── Onboarding.tsx
│   └── OnboardingSurvey.tsx
├── orb/
│   ├── EmotionOrb.module.css
│   ├── EmotionOrb.tsx
│   ├── OrbPipButton.module.css
│   ├── OrbPipButton.tsx
│   └── ReactiveOrb.tsx
├── report/
│   ├── CheckInCard.tsx
│   ├── DailyReport.tsx
│   ├── RecentRecords.tsx
│   └── TrendChart.tsx
└── RiskAlert.tsx
hooks/
├── checkin/
│   └── useCheckin.ts
├── emotion/
│   └── useEmotionRecorder.ts
├── nudge/
│   ├── useNotificationPermission.ts
│   └── useNudge.ts
└── ui/
    ├── useOrbPip.ts
    └── useScrollReveal.ts
lib/
├── checkin/
│   ├── checkin.ts
│   └── checkinCopy.ts
├── emotion/
│   ├── emotionAggregator.ts
│   ├── emotionAnalysis.ts
│   ├── emotionRepository.ts
│   └── selfCareSuggestion.ts
├── nudge/
│   └── nudge.ts
├── orb/
│   ├── orbCaption.ts
│   ├── orbColor.ts
│   ├── orbMotion.ts
│   ├── orbStages.ts
│   └── pip.ts
├── storage/
│   ├── dayState.ts
│   ├── db.ts
│   ├── profile.ts
│   └── settings.ts
├── stress/
│   ├── baseline.ts
│   ├── calibration.ts
│   ├── dailyStress.ts
│   ├── riskCalculator.ts
│   └── stressIndex.ts
└── notification.ts
tests/
├── components/
│   ├── common/
│   │   └── ContactsFooter.test.tsx
│   ├── nudge/
│   │   ├── NudgeBanner.test.tsx
│   │   └── NudgeSettings.test.tsx
│   ├── onboarding/
│   │   └── OnboardingSurvey.test.tsx
│   └── report/
│       ├── CheckInCard.test.tsx
│       └── DailyReport.test.tsx
├── hooks/
│   ├── checkin/
│   │   └── useCheckin.test.tsx
│   ├── emotion/
│   │   └── useEmotionRecorder.test.tsx
│   └── nudge/
│       ├── useNotificationPermission.test.tsx
│       └── useNudge.test.tsx
├── lib/
│   ├── checkin/
│   │   ├── checkin.test.ts
│   │   └── checkinCopy.test.ts
│   ├── emotion/
│   │   ├── emotionAggregator.test.ts
│   │   ├── emotionAnalysis.test.ts
│   │   ├── emotionRepository.test.ts
│   │   └── selfCareSuggestion.test.ts
│   ├── nudge/
│   │   └── nudge.test.ts
│   ├── orb/
│   │   ├── orbCaption.test.ts
│   │   ├── orbColor.test.ts
│   │   ├── orbMotion.test.ts
│   │   ├── orbStages.test.ts
│   │   └── pip.test.ts
│   ├── storage/
│   │   ├── dayState.test.ts
│   │   ├── profile.test.ts
│   │   └── settings.test.ts
│   └── stress/
│       ├── baseline.test.ts
│       ├── calibration.test.ts
│       ├── dailyStress.test.ts
│       ├── riskCalculator.test.ts
│       └── stressIndex.test.ts
└── setup.ts
```

## 문서와 정적 자산

```text
docs/
├── architecture/
│   └── PROJECT_STRUCTURE.md
├── collaboration/
│   └── CODE_OWNERSHIP.md
├── superpowers/
│   ├── plans/
│   └── specs/
├── roadmap.md
└── 2026-1학기-정리.md
public/
├── models/
├── sw.js
├── manifest.json
└── 기존 SVG 자산
```

기존 설계·구현 계획과 학기 정리는 당시 기록이므로 경로와 예제를 일괄 수정하지 않았습니다. `public/`의 모델·서비스 워커·manifest·아이콘, `app/`의 라우트 위치를 보존했습니다. 현재 비어 있고 사용처가 없는 `components/RiskAlert.tsx`, `lib/notification.ts`도 원래 위치에 보존하며 담당자만 명시합니다.

## 의존 방향과 변경 범위

기본 흐름은 `app → components → hooks → lib`이며 화면은 필요에 따라 `lib`를 직접 참조합니다. `lib`는 `components`, `hooks`, `app`을 import하지 않습니다. 감정 기록 저장소는 `storage/db`를 런타임에 사용하고, `storage/db`의 감정 타입 참조는 타입 전용입니다. 이를 이유로 타입이나 공개 API를 새로 분리하지 않았습니다.

기존 `@/*` alias와 상대 import 형태를 유지했습니다. 정적 import, 테스트 import와 `vi.mock` 대상 경로를 갱신하고 CSS Module은 해당 컴포넌트와 함께 이동했습니다. `/models`, `/sw.js`, `/favicon.ico` 같은 공개 URL은 소스 경로가 아니므로 유지했습니다.

UI, 계산식, 데이터 모델, IndexedDB schema, 저장 키, 테스트 케이스와 skip, 의존성 선언, 프로젝트 설정은 이번 구조 정리의 변경 대상이 아닙니다. barrel export와 새로운 alias도 추가하지 않았습니다.

## 재분류 검증 (2026-10-06)

| 명령 | 결과 |
|---|---|
| `npm run test:run` | PASS — 30개 파일, 139 passed / 기존 4 skipped |
| `npm run lint` | PASS |
| `npm run build` | PASS — TypeScript 검사와 기존 라우트 정적 생성 완료 |

이동 전 테스트·lint도 통과했으며 이동 후 테스트 결과와 동일합니다. 메모리 사용량을 줄이기 위해 테스트는 `VITEST_MAX_WORKERS=2` 환경 변수로 실행했습니다. 각 계층 이동 후 관련 테스트를 실행하고, 마지막에 전체 테스트를 다시 실행했습니다.

기존 파일 135개를 원본 커밋과 비교해 import 경로 외의 내용을 보존했음을 확인했습니다(별도로 수정한 README·AGENTS 제외). 별도 검토에서 TS/TSX 91개의 import·mock 경로와 로컬 참조 161개, 테스트 30개의 위치를 확인했습니다. 소스 파일 단위 순환 의존성과 `lib → UI` 참조는 발견되지 않았습니다.

설치 시 원본 lock 파일의 일부 `@emnapi` 선택 의존성 불일치로 이 Windows 환경에서 `npm ci`가 실패했습니다. 검증에는 Node 22.20.0과 기본 설치 npm 10.9.3의 `npm install --no-save --no-audit --no-fund`를 사용했고, 이동 전후 같은 설치 환경을 사용했습니다. 로컬 선택 의존성 중 `@emnapi/wasi-threads`는 lock의 1.2.1 대신 1.2.3으로 해석됐습니다. `package.json`과 `package-lock.json`은 변경하지 않았으며 lock 파일 정비는 별도 작업입니다.

이후 Orca 협업 환경 구성에서 이 선택 의존성 누락을 lock 파일에 반영했습니다. 현재 설치·검사 절차와 새 협업 도구는 [ORCA_WORKFLOW.md](../collaboration/ORCA_WORKFLOW.md)를 따릅니다. 위 검증 기록과 아래 경로표는 도메인 재분류 시점의 기록입니다.

## 전체 이동 경로 (84개)

### components (27개)

| 기존 경로 | 새 경로 |
|---|---|
| `components/AppChrome.tsx` | `components/common/AppChrome.tsx` |
| `components/CameraView.tsx` | `components/measure/CameraView.tsx` |
| `components/CheckInCard.tsx` | `components/report/CheckInCard.tsx` |
| `components/ContactsFooter.tsx` | `components/common/ContactsFooter.tsx` |
| `components/DailyReport.tsx` | `components/report/DailyReport.tsx` |
| `components/EmotionDisplay.tsx` | `components/measure/EmotionDisplay.tsx` |
| `components/EmotionOrb.module.css` | `components/orb/EmotionOrb.module.css` |
| `components/EmotionOrb.tsx` | `components/orb/EmotionOrb.tsx` |
| `components/LandingCTA.tsx` | `components/landing/LandingCTA.tsx` |
| `components/LandingData.tsx` | `components/landing/LandingData.tsx` |
| `components/LandingFeatures.tsx` | `components/landing/LandingFeatures.tsx` |
| `components/LandingFooter.tsx` | `components/landing/LandingFooter.tsx` |
| `components/LandingHero.tsx` | `components/landing/LandingHero.tsx` |
| `components/LandingNav.tsx` | `components/landing/LandingNav.tsx` |
| `components/LandingRisk.tsx` | `components/landing/LandingRisk.tsx` |
| `components/Navigation.tsx` | `components/common/Navigation.tsx` |
| `components/NudgeBanner.tsx` | `components/nudge/NudgeBanner.tsx` |
| `components/NudgeHost.tsx` | `components/nudge/NudgeHost.tsx` |
| `components/NudgeSettings.tsx` | `components/nudge/NudgeSettings.tsx` |
| `components/Onboarding.tsx` | `components/onboarding/Onboarding.tsx` |
| `components/OnboardingSurvey.tsx` | `components/onboarding/OnboardingSurvey.tsx` |
| `components/OrbPipButton.module.css` | `components/orb/OrbPipButton.module.css` |
| `components/OrbPipButton.tsx` | `components/orb/OrbPipButton.tsx` |
| `components/ReactiveOrb.tsx` | `components/orb/ReactiveOrb.tsx` |
| `components/RecentRecords.tsx` | `components/report/RecentRecords.tsx` |
| `components/ServiceWorkerRegistrar.tsx` | `components/common/ServiceWorkerRegistrar.tsx` |
| `components/TrendChart.tsx` | `components/report/TrendChart.tsx` |

### lib (21개)

| 기존 경로 | 새 경로 |
|---|---|
| `lib/baseline.ts` | `lib/stress/baseline.ts` |
| `lib/calibration.ts` | `lib/stress/calibration.ts` |
| `lib/checkin.ts` | `lib/checkin/checkin.ts` |
| `lib/checkinCopy.ts` | `lib/checkin/checkinCopy.ts` |
| `lib/dailyStress.ts` | `lib/stress/dailyStress.ts` |
| `lib/dayState.ts` | `lib/storage/dayState.ts` |
| `lib/db.ts` | `lib/storage/db.ts` |
| `lib/emotionAggregator.ts` | `lib/emotion/emotionAggregator.ts` |
| `lib/emotionAnalysis.ts` | `lib/emotion/emotionAnalysis.ts` |
| `lib/emotionRepository.ts` | `lib/emotion/emotionRepository.ts` |
| `lib/nudge.ts` | `lib/nudge/nudge.ts` |
| `lib/orbCaption.ts` | `lib/orb/orbCaption.ts` |
| `lib/orbColor.ts` | `lib/orb/orbColor.ts` |
| `lib/orbMotion.ts` | `lib/orb/orbMotion.ts` |
| `lib/orbStages.ts` | `lib/orb/orbStages.ts` |
| `lib/pip.ts` | `lib/orb/pip.ts` |
| `lib/profile.ts` | `lib/storage/profile.ts` |
| `lib/riskCalculator.ts` | `lib/stress/riskCalculator.ts` |
| `lib/selfCareSuggestion.ts` | `lib/emotion/selfCareSuggestion.ts` |
| `lib/settings.ts` | `lib/storage/settings.ts` |
| `lib/stressIndex.ts` | `lib/stress/stressIndex.ts` |

### hooks (6개)

| 기존 경로 | 새 경로 |
|---|---|
| `hooks/useCheckin.ts` | `hooks/checkin/useCheckin.ts` |
| `hooks/useEmotionRecorder.ts` | `hooks/emotion/useEmotionRecorder.ts` |
| `hooks/useNotificationPermission.ts` | `hooks/nudge/useNotificationPermission.ts` |
| `hooks/useNudge.ts` | `hooks/nudge/useNudge.ts` |
| `hooks/useOrbPip.ts` | `hooks/ui/useOrbPip.ts` |
| `hooks/useScrollReveal.ts` | `hooks/ui/useScrollReveal.ts` |

### tests (30개)

| 기존 경로 | 새 경로 |
|---|---|
| `tests/components/CheckInCard.test.tsx` | `tests/components/report/CheckInCard.test.tsx` |
| `tests/components/ContactsFooter.test.tsx` | `tests/components/common/ContactsFooter.test.tsx` |
| `tests/components/DailyReport.test.tsx` | `tests/components/report/DailyReport.test.tsx` |
| `tests/components/NudgeBanner.test.tsx` | `tests/components/nudge/NudgeBanner.test.tsx` |
| `tests/components/NudgeSettings.test.tsx` | `tests/components/nudge/NudgeSettings.test.tsx` |
| `tests/components/OnboardingSurvey.test.tsx` | `tests/components/onboarding/OnboardingSurvey.test.tsx` |
| `tests/hooks/useCheckin.test.tsx` | `tests/hooks/checkin/useCheckin.test.tsx` |
| `tests/hooks/useEmotionRecorder.test.tsx` | `tests/hooks/emotion/useEmotionRecorder.test.tsx` |
| `tests/hooks/useNotificationPermission.test.tsx` | `tests/hooks/nudge/useNotificationPermission.test.tsx` |
| `tests/hooks/useNudge.test.tsx` | `tests/hooks/nudge/useNudge.test.tsx` |
| `tests/lib/baseline.test.ts` | `tests/lib/stress/baseline.test.ts` |
| `tests/lib/calibration.test.ts` | `tests/lib/stress/calibration.test.ts` |
| `tests/lib/checkin.test.ts` | `tests/lib/checkin/checkin.test.ts` |
| `tests/lib/checkinCopy.test.ts` | `tests/lib/checkin/checkinCopy.test.ts` |
| `tests/lib/dailyStress.test.ts` | `tests/lib/stress/dailyStress.test.ts` |
| `tests/lib/dayState.test.ts` | `tests/lib/storage/dayState.test.ts` |
| `tests/lib/emotionAggregator.test.ts` | `tests/lib/emotion/emotionAggregator.test.ts` |
| `tests/lib/emotionAnalysis.test.ts` | `tests/lib/emotion/emotionAnalysis.test.ts` |
| `tests/lib/emotionRepository.test.ts` | `tests/lib/emotion/emotionRepository.test.ts` |
| `tests/lib/nudge.test.ts` | `tests/lib/nudge/nudge.test.ts` |
| `tests/lib/orbCaption.test.ts` | `tests/lib/orb/orbCaption.test.ts` |
| `tests/lib/orbColor.test.ts` | `tests/lib/orb/orbColor.test.ts` |
| `tests/lib/orbMotion.test.ts` | `tests/lib/orb/orbMotion.test.ts` |
| `tests/lib/orbStages.test.ts` | `tests/lib/orb/orbStages.test.ts` |
| `tests/lib/pip.test.ts` | `tests/lib/orb/pip.test.ts` |
| `tests/lib/profile.test.ts` | `tests/lib/storage/profile.test.ts` |
| `tests/lib/riskCalculator.test.ts` | `tests/lib/stress/riskCalculator.test.ts` |
| `tests/lib/selfCareSuggestion.test.ts` | `tests/lib/emotion/selfCareSuggestion.test.ts` |
| `tests/lib/settings.test.ts` | `tests/lib/storage/settings.test.ts` |
| `tests/lib/stressIndex.test.ts` | `tests/lib/stress/stressIndex.test.ts` |
