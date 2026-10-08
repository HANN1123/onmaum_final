# 2026년 2학기 역할 기준 재분류

## 작업 명세와 범위

- 기준: `c39be13` (`chore/orca-collaboration`), 작업 브랜치: `chore/reclassify-by-role`.
- 목표: ① 카메라 인식 ② Electron ③ 서버·관리자 ④ UI ⑤ 알고리즘 ⑥ 피드백 책임을 코드 경로와 일치시킨다.
- 이정환: ③⑤⑥ 및 공통 저장 계층 주 관리. 김우빈: ①②④.
- 구현 에이전트는 현재 작업 공간에서 하나만 사용하고, 분석·검토 에이전트는 읽기 전용으로 참여한다.
- 변경 전 `app`, `components`, `hooks`, `lib`, `tests`, `docs`, `public`의 실제 내용·참조를 분석했다. Next.js 설치본의 프로젝트 구조·Client Components·CSS 가이드를 확인했다.

### 사전 공유: 도메인·공통 파일·공개 계약

이 작업은 두 담당자의 소스·테스트 경로 전체를 재분류한다. `app/layout.tsx`와 route의 import, `AGENTS.md`, `README.md`, 협업·구조 문서, GitHub Issue/PR 양식을 함께 수정한다. `package.json`, lock 파일, 프레임워크·테스트 설정, 전역 스타일, `public` 자산은 그대로 둔다.

공개 함수·props·타입의 모양과 반환값은 유지하고 import 경로만 바뀐다. 한 예외는 혼합 파일의 **기존 선언 위치 분리**다. `emotionAnalysis.ts`의 face-api import, 모델 상수, `loadFaceApiModels`, `analyzeEmotion` 선언을 카메라의 `faceDetection.ts`로 옮긴다. 함수 본문·검출 옵션은 그대로 유지한다. 기존 `RawExpressions`와 `EmotionResult`를 재사용하며 새 중복 타입이나 재수출용 barrel을 만들지 않는다.

### 내용 기반 분류 결정

- `CameraView`는 스트림 입력, `EmotionDisplay`는 계산 결과 표시이므로 각각 camera와 ui로 간다.
- `useEmotionRecorder`는 카메라 루프와 집계·저장의 통합 훅이다. camera에 두고 집계·저장 계약은 공동 검토한다. 내부 효과·타이머는 분해하지 않는다.
- `dayState`는 체크인·넛지 localStorage 읽기/쓰기다. 알고리즘이 아닌 공통 저장 계층이다.
- `emotionRepository`는 Dexie CRUD와 조회만 수행하므로 공통 저장 계층이다.
- `checkinCopy`, 알림 권한 훅, 체크인·넛지 컴포넌트, 자기관리 제안은 feedback에 모은다. 시각 디자인은 김우빈과 함께 검토한다.
- 오브의 색상·모션·성장 표현·캡션·Document PiP는 ui에 둔다. 브라우저 PiP는 Electron이 아니다.
- `DailyReport`의 기존 평균 계산·결과 조합은 유지하고 알고리즘 해석을 바꾸는 경우 공동 검토한다.
- Electron·서버/관리자 구현은 없다. 빈 디렉터리·기능·의존성을 추가하지 않고 향후 위치만 지정한다.
- 빈 `RiskAlert.tsx`, `notification.ts`는 빈 상태 그대로 feedback으로 이동한다.

## 구현 순서와 완료 조건

분석 → 알고리즘 → 카메라 → 피드백 → UI → 미구현 인프라 위치 문서화 → shared → 테스트 → 문서 순서로 진행한다. 각 단계 뒤 `npm run test:run`, 가능한 경우 `npx tsc --noEmit`으로 검사하고 실패는 다음 이동 전에 해결한다.

완료 조건은 기존 30개 앱 테스트 파일의 기대값 및 recorder skip 4개 보존, `npm run check`와 TypeScript 통과, 옛 import·mock·CSS 경로 전수 점검, 계산·카메라·피드백·UI·DB·의존성의 비의도 변경 없음이다. 최종 실제 트리와 전체 이동표는 [프로젝트 구조](../architecture/PROJECT_STRUCTURE.md), 담당자와 공동 충돌 지점은 [Code Ownership](CODE_OWNERSHIP.md)에 기록한다.

## 검증 결과

알고리즘 → 카메라 → 피드백 → UI → shared → 테스트 재배치의 각 단계에서 앱 테스트 **30개 파일, 139 passed / 기존 4 skipped**와 `npx tsc --noEmit` 통과를 확인했다. Electron/Admin 단계는 구현 없이 소유권만 문서화했다.

이동 전 첫 2-worker 기본 pool 실행은 시작 후 진행되지 않아 해당 실행만 중단했다. 이동 전 기준 및 단계별 검사는 `VITEST_MAX_WORKERS=1`과 `npm run test:run -- --pool=threads`로 통과했다. 프레임워크·Vitest 설정·package 파일은 수정하지 않았다. 최종 `npm run check`는 `VITEST_MAX_WORKERS=1`에서 **기본 pool**로 실행해 모두 통과했다.

**ROLE RECLASSIFICATION: PASS** — 2026-10-07.

| 최종 검사 | 결과 |
|---|---|
| `npm run test:tooling` | PASS — 7 passed |
| `npm run test:run` | PASS — 30파일, 139 passed / 4 skipped |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — 기존 app route 정적 생성 완료 |
| `npm run check` | PASS — tooling → 앱 테스트 → lint → build |
| `git diff --check HEAD` | PASS |

검증은 기준 커밋과 같은 Node 22.20.0 및 기존 작업 공간 의존성에서 실행했다. 새 checkout이 아니므로 의존성을 재설치하지 않았다. 작업은 전용 브랜치의 로컬 변경으로 남겼고 커밋·push·PR·main 병합은 수행하지 않았다.

### 독립 읽기 전용 검토

- Algorithm/Camera: 모듈 10개의 import 제외 선언 65개가 기준 커밋과 동일했다. 기존 카메라 선언 4개와 알고리즘 선언 7개가 정확히 분리됐다.
- Feedback/UI/Shared: 소스 47개와 관련 테스트 22개가 모듈 경로·개행 표기를 제외하고 동일했다. route/layout TSX 6개 본문도 동일했다.
- import/mock 참조 164개(검토 대상 로컬 102개·패키지 62개)의 대상이 유지됐다. 전체 소스 모듈 61개·런타임 의존 85개에 순환이 없었다.
- CSS·설정·의존성·정적 자산 27개 보존을 확인했다. 바이너리 6개는 바이트가 동일하고 텍스트는 checkout 개행을 정규화하면 동일했다.
- 전체 86개 이동표와 문서 트리의 실제 파일 97개가 디스크와 일치했다. Markdown 로컬 링크 오류와 현존 모듈의 옛 import는 없었다. 과거 문서의 잔여 옛 import는 폐기된 기능 기록이다.

실제 웹캠 장치·브라우저 권한·PiP 수동 조작은 실행하지 않았다. 카메라·UI 보존 판정은 원본 선언/JSX/CSS 비교와 자동 테스트·빌드에 근거한다.

### 비의도 변경

| 항목 | 변경 여부 |
|---|---|
| Algorithm behavior changed | NO |
| Camera behavior changed | NO |
| Feedback behavior changed | NO |
| UI behavior changed | NO |
| DB schema changed | NO |
| Dependencies changed | NO |

### 남은 공동 충돌 위험

`useEmotionRecorder`, `DailyReport`, `app/measure`, `app/stats`, feedback 컴포넌트는 기존 통합 지점이다. 공통 저장 schema·타입·함수 계약, layout·globals, package/lock·설정·협업 문서는 동시에 수정하기 전에 범위를 공유한다. 기존 Orca 작업 공간은 자동 변경하지 않았으므로 이 재분류를 받아오기 전 작업과 경로 충돌이 날 수 있다. 커밋/PR 단위로 공유하고 상대 팀원의 검토 후 통합한다.

### 다음 브랜치

- 김우빈: `feat/camera-recognition`, `spike/electron-background`, `feat/ui-redesign`.
- 이정환: `feat/admin-dashboard`, `refactor/emotion-algorithm`, `feat/feedback-system`.

위 기능은 이번 작업에서 구현하지 않았다. GitHub 계정·리뷰 권한을 추정해 CODEOWNERS를 만들지 않았다. 이전 위치의 빈 디렉터리 정리는 자동 승인 정책이 차단하여 유지했다. 빈 디렉터리는 Git에 포함되지 않는다.
