# ONMAUM Code Ownership

온마음은 이정환(Core / Data / Architecture / Algorithm)과 김우빈(UI / UX / Frontend)이 각자의 AI Coding Agent와 함께 개발합니다. 사람 이름으로 소스 폴더를 나누지 않고, 기능과 책임을 기준으로 담당 영역을 구분합니다.

이 문서는 재분류 후 실제 경로를 기준으로 합니다. 전체 구조와 이전 경로 대응표는 [PROJECT_STRUCTURE.md](../architecture/PROJECT_STRUCTURE.md)를 참고합니다. Primary Owner는 주 담당자이며 독점 소유자가 아닙니다.

## 이정환 — Core / Data / Architecture / Algorithm

| 주 담당 경로 | 책임 |
|---|---|
| `lib/emotion/**` | 얼굴 표정 분석, 감정 집계, 감정 기록 조회·저장, 감정·프로필 기반 회복 제안 |
| `lib/stress/**` | 스트레스 지수, 일별 집계, 개인 기준선, 자기보고 보정, 계산 가중치 |
| `lib/storage/**` | IndexedDB, 로컬 프로필·설정, 체크인·넛지 일일 상태 저장 |
| `lib/checkin/checkin.ts` | 체크인 시간대와 노출 조건 판정 |
| `lib/nudge/nudge.ts` | 넛지 지속 시간, 횟수 제한, 쿨다운, 방해 금지 조건 |
| `hooks/emotion/**` | 측정 루프, 감정 집계와 저장 연결 |
| `hooks/checkin/**` | 체크인 판정·표시 데이터·보정·저장 연결 |
| `hooks/nudge/useNudge.ts` | 넛지 판정, 일일 상태 저장, 브라우저 알림 실행 |
| `public/models/**` | 얼굴 인식 모델 파일과 로딩 계약 |
| `public/sw.js` | 서비스 워커 캐시와 오프라인 동작 |
| `docs/architecture/PROJECT_STRUCTURE.md` | 소스 구조, 의존 방향, 이동 경로 기록 |

관련 테스트도 같은 담당자를 따릅니다.

- `tests/lib/emotion/**`, `tests/lib/stress/**`, `tests/lib/storage/**`
- `tests/lib/checkin/checkin.test.ts`, `tests/lib/nudge/**`
- `tests/hooks/emotion/**`, `tests/hooks/checkin/**`, `tests/hooks/nudge/useNudge.test.tsx`

`lib/emotion/selfCareSuggestion.ts`의 선택 규칙은 Core 담당이고, 사용자에게 보이는 문구는 김우빈과 함께 검토합니다. `hooks/nudge/useNudge.ts`도 판정·저장 책임은 Core에 두되 알림 문구와 상호작용은 UI 담당과 맞춥니다.

## 김우빈 — UI / UX / Frontend

| 주 담당 경로 | 책임 |
|---|---|
| `components/common/**` | 공통 화면 틀, 내비게이션, 연락처 푸터, 서비스 워커 등록 연결 |
| `components/landing/**` | 랜딩 화면 |
| `components/report/**` | 일일 리포트, 차트, 최근 기록, 체크인 카드 |
| `components/onboarding/**` | 온보딩과 설문 화면 |
| `components/orb/**` | 오브 렌더링, 애니메이션, PiP 버튼, 관련 CSS Module |
| `components/nudge/**` | 넛지 배너·호스트·설정 화면 |
| `lib/orb/**` | 오브 색상·모션·카피·성장 표현, PiP 지원 확인 |
| `lib/checkin/checkinCopy.ts` | 스트레스 단계와 기준선 모드에 대응하는 체크인 문구 |
| `hooks/ui/**` | PiP 창의 UI 생명주기, 스크롤 등장 효과 |
| `hooks/nudge/useNotificationPermission.ts` | 브라우저 알림 권한의 UI 상태와 요청 흐름 |
| `app/page.tsx`, `app/stats/**`, `app/demo/**`, `app/orb-preview/**` | 일반 화면과 화면 조합 |
| `app/favicon.ico`, `public/*.svg` | 파비콘, 앱 아이콘, 정적 시각 자산 |

관련 테스트도 같은 담당자를 따릅니다.

- `tests/components/**`
- `tests/lib/orb/**`, `tests/lib/checkin/checkinCopy.test.ts`
- `tests/hooks/nudge/useNotificationPermission.test.tsx`

`lib/` 전체가 Core 담당인 것은 아닙니다. 오브 표현 함수와 체크인 카피는 UI 책임입니다. 다만 `lib/orb/orbStages.ts`의 성장 임계값이나 감정 데이터의 해석을 바꾸는 작업은 Core 담당과 함께 검토합니다.

## 공동 관리와 경계 영역

| 경로 | 협업 기준 |
|---|---|
| `components/measure/**`, `app/measure/**` | 카메라·감정 표시·측정 시작/종료가 만나는 경계. UI 변경은 김우빈, 측정·저장 계약은 이정환 중심으로 검토 |
| `hooks/emotion/**` | Core 주 담당. 반환값, 옵션, 측정 생명주기가 달라지면 측정 UI 사용처도 함께 확인 |
| `components/common/ServiceWorkerRegistrar.tsx`, `public/sw.js` | 등록 경로와 캐시 동작이 연결되므로 두 담당자가 변경 영향을 공유 |
| `app/layout.tsx`, `app/globals.css`, `public/manifest.json` | 앱 전체 화면 틀, 전역 스타일, PWA 설정의 공통 접점 |
| `package.json`, `package-lock.json` | 실행 명령과 의존성의 공통 접점 |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `tests/setup.ts`, `.gitignore` | 빌드·타입·스타일·테스트·개발 환경 설정 |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.gemini/settings.json`, `README.md`, `docs/collaboration/**` | 에이전트 작업 규칙, 프로젝트 사용법, 협업 기준 |
| `.github/**`, `scripts/collaboration/**`, `tests/tooling/**`, `.node-version`, `.gitattributes` | PR·CI·작업 공간 설치·검사와 공통 실행 환경 |
| `docs/architecture/PROJECT_STRUCTURE.md` | Core 주 담당이지만 UI/Core 경계를 설명하는 내용은 함께 관리 |
| `docs/roadmap.md`, `docs/2026-1학기-정리.md` | 제품 방향, 계획, 학기별 기록 |

공동 관리란 변경 목적과 영향을 공유하고 PR에서 상대 담당자의 검토를 받는 기준입니다. 이미 합의된 작업 범위 안의 파일 이동과 import 수정마다 별도의 승인 절차를 추가하지 않습니다.

## 남겨 둔 파일과 기존 문서

- `components/RiskAlert.tsx`: 현재 비어 있는 파일이며 원래 위치에 보존합니다. UI 담당을 기준으로 하고, 실제 경고 조건을 도입하는 작업은 Core와 함께 설계합니다.
- `lib/notification.ts`: 현재 비어 있고 사용처가 없는 파일이며 원래 위치에 보존합니다. Core 담당을 기준으로 합니다. 현재 알림 실행은 `hooks/nudge/useNudge.ts`, 권한 UI는 `hooks/nudge/useNotificationPermission.ts`에 있습니다.
- `docs/superpowers/specs/**`, `docs/superpowers/plans/**`: 당시 설계와 구현 계획을 보존합니다. 감정 분석·저장·스트레스 관련 기록은 Core, 오브·화면 관련 기록은 UI, 혼합 문서는 공동으로 관리합니다. 문서 안의 과거 경로와 코드 예시는 현재 파일 위치의 기준으로 사용하지 않습니다.
- `app/`의 라우트와 `public/`의 공개 URL은 유지합니다. 모델 경로(`/models`), 서비스 워커(`/sw.js`), 아이콘·manifest 경로는 소스 폴더 이동과 별개입니다.
- 테스트는 실제 소스 영역에 맞추되, 테스트가 없는 영역을 위해 빈 폴더를 만들지 않습니다.

## 작업 원칙

1. 작업 전 `git status`, 현재 브랜치와 이 문서를 확인합니다. `main`에서 직접 작업하지 않고 기존 변경사항을 보존합니다.
2. 담당 영역 밖을 수정할 수 있지만, PR에서 변경 이유와 영향을 설명합니다. 공통 파일과 공개 타입·함수 계약을 바꿀 때는 상대 담당자와 변경 범위를 맞춥니다.
3. 기본 의존 방향은 `app → components → hooks → lib`입니다. `components`가 `lib`를 직접 사용하는 것은 허용하며, `lib`가 UI 컴포넌트를 import하는 방향은 피합니다.
4. 기존 `@/*` alias와 상대 import 방식을 유지합니다. 파일을 이동할 때 import, mock 대상 문자열, CSS Module 참조와 관련 테스트 경로를 함께 확인합니다.
5. 구조 정리와 기능 변경을 섞지 않습니다. 이번 재분류는 UI, 분석·계산 규칙, 데이터 모델, IndexedDB schema, 저장 키, 라이브러리를 유지합니다.
6. 변경 범위에 맞게 검증하며 구조 변경 완료 시 `npm run test:run`, `npm run lint`, `npm run build` 결과를 확인합니다. 기존 실패와 skip은 새 문제와 구분합니다.

## 향후 확장 책임

Electron/Core, 서버 연동, 세션 구조, 관리자 데이터 계약과 알고리즘은 이정환이 중심이 되고, 해당 화면과 사용자 흐름은 김우빈이 중심이 됩니다. 이는 향후 계획이며 현재 존재하지 않는 `electron/`, 서버 또는 관리자 전용 폴더를 이번 구조의 실제 경로로 간주하지 않습니다. 구현을 시작할 때 실제 경로와 경계를 이 문서에 추가합니다.
