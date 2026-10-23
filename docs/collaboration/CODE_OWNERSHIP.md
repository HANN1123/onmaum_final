# ONMAUM Code Ownership

2026년 2학기 공식 역할분담을 기준으로 한다(2026-10-18 개정). 이정환(팀장)은 ③ 개인 데이터 관리 ⑤ 감정 및 개인 상태 분석 ⑥ 개인 맞춤 피드백, 김우빈(팀원)은 ① 카메라·rPPG ② Electron ④ UI/UX를 맡는다. Primary Owner는 주 담당자이며 독점 소유자가 아니다. 관리자 페이지와 조직·직원 관리는 현재 개발 범위에서 제외한다.

업무는 `Spec → 구현 계획 → 테스트 정의 → 기능 브랜치 → 개발 → 테스트 → PR → 상대 팀원 Review → main Merge`로 진행한다. 실제 트리·이동표는 [프로젝트 구조](../architecture/PROJECT_STRUCTURE.md), 2026-10-07 재분류 당시의 범위·검증은 [재분류 작업 명세](ROLE_RECLASSIFICATION.md), 작업 공간 운영은 [Orca 가이드](ORCA_WORKFLOW.md)를 따른다.

## 업무 범위

### 이정환 (팀장)

- **③ 개인 데이터 관리**: 세션·측정 기록 저장, IndexedDB/Dexie, 데이터 내보내기·삭제, 개인 통계 데이터
- **⑤ 감정 및 개인 상태 분석**: 표정 감정 정규화·집계, 개인 기준선, 생체신호 변화 추세, 감정·자기보고·심박 결과 비교, 리포트 계산
- **⑥ 개인 맞춤 피드백**: 피드백 조건, 휴식·호흡 안내 규칙, 체크인, 넛지, 피드백 기록

### 김우빈 (팀원)

- **① 카메라·rPPG**: 웹캠, 얼굴 추적, 표정 raw 확률 검출, RGB 시계열 수집, rPPG 신호처리 전체, BPM 추정, 측정 품질 판정, 기준 센서 정확도 비교
- **② Electron**: 메인 프로세스, preload·IPC, 백그라운드 동작, Windows 실행·패키징
- **④ UI/UX**: 측정 화면, 개인 대시보드, 실시간 심박 시각화, 감정·통계 차트, 리포트 화면, 피드백 UI의 시각 디자인, 반응형

## 담당 경로 요약

| 담당 | 현재 경로 | 예정 경로 (지금 만들지 않음) |
|---|---|---|
| 이정환 | `features/algorithm/**`, `features/feedback/{lib,hooks}/**`, `shared/storage/**`(주 관리), `tests/algorithm/**`, `tests/feedback/**`, `tests/shared/**` | 데이터 내보내기·삭제 기능 위치는 구현할 때 정한다 |
| 김우빈 | `features/camera/**`, `features/ui/**`, `public/models/**`, `app/page.tsx`, `app/demo/**`, `app/orb-preview/**`, `tests/camera/**`, `tests/ui/**` | `features/rppg/`, `features/electron/{main,preload,window,types}/` |
| 공동 | `features/feedback/components/**`, `features/camera/hooks/useEmotionRecorder.ts`, `app/measure/**`, `app/stats/**`, `emotionAnalysis.ts`·`db.ts`의 공개 타입, PWA(`ServiceWorkerRegistrar.tsx`, `public/sw.js`, `manifest.json`), `app/layout.tsx`, `app/globals.css`, `package*.json`, 빌드·테스트 설정, `AGENTS.md`·`CLAUDE.md`·`GEMINI.md`·`README.md`, `docs/collaboration/**`, `docs/architecture/**`, `.github/**`, `scripts/collaboration/**`, `tests/tooling/**` | — |

- 공동 영역이나 상대 담당 파일을 바꿀 때는 목적·영향·파일 목록을 작업 명세와 PR에 적는다.
- 이미 합의된 범위의 일상적인 수정마다 별도 승인 단계를 추가하지 않는다.
- 계약 변경(DB schema, 저장 키, 공개 타입, props, rPPG 결과 형식)은 상대에게 먼저 공유하고, 작은 커밋으로 분리한다.

## 이정환 — ③ 개인 데이터 관리 / ⑤ 감정 및 개인 상태 분석 / ⑥ 개인 맞춤 피드백

| 파일/디렉터리 | 업무번호 | 이유 |
|---|---|---|
| `features/algorithm/emotion/**` | ⑤ | raw 정규화, 감정 타입·상수, 우세 감정, 프레임 집계 |
| `features/algorithm/stress/**` | ⑤ | 긍정·스트레스 지수, 일별·시간대 집계, 가중치 |
| `features/algorithm/baseline/**` | ⑤ | 개인 기준선, 상태 분류, 자기보고 보정 |
| `features/feedback/lib/**` | ⑥ | 체크인·넛지 조건, 피드백 문구·자기관리 제안 선택 |
| `features/feedback/hooks/**` | ⑥ | 체크인·넛지 상태와 저장, 브라우저 알림·권한 연결 |
| `shared/storage/**` | ③ / Shared | Dexie CRUD/schema, 세션·측정 기록, 프로필·설정·일일 상태. 이정환 주 관리, 공동 주의 영역 |
| `tests/algorithm/**`, `tests/feedback/**`, `tests/shared/**` | ⑤⑥ / Shared | 해당 소스의 동작 검증 |

③ 개인 데이터 관리는 현재 `shared/storage/**`의 기록 저장이 중심이다. 저장 계층에는 감정 기록 전체 삭제 함수 `deleteAllEmotions()`가 있지만, 데이터 내보내기와 사용자가 쓰는 삭제 기능은 아직 없다. 그 위치는 구현할 때 정한다. 원본 영상·얼굴 이미지·개인 raw frame·불필요한 식별 정보를 기본 수집 대상으로 삼지 않으며, 동의된 최소 정보를 우선한다.

## 김우빈 — ① 카메라·rPPG / ② Electron / ④ UI/UX

| 파일/디렉터리 | 업무번호 | 이유 |
|---|---|---|
| `features/camera/components/CameraView.tsx` | ① | 웹캠 권한·video stream·카메라 오류 처리 |
| `features/camera/lib/faceDetection.ts` | ① | face-api 모델 로딩·얼굴·랜드마크·raw 표정 검출, 알고리즘 호출 어댑터 |
| `public/models/**` | ① | 모델 자산과 `/models` 로딩 계약 |
| `features/ui/common/**` | ④ | 앱 틀·내비게이션·푸터·서비스 워커 등록 |
| `features/ui/landing/**` | ④ | 랜딩 화면 |
| `features/ui/measure/**` | ④ | 계산된 감정 결과 표시 |
| `features/ui/report/**` | ④ / 공동 | 리포트·차트·최근 기록 표현. 계산 해석은 이정환 공동 검토 |
| `features/ui/onboarding/**` | ④ | 온보딩·설문 화면 |
| `features/ui/orb/**`, `features/ui/hooks/**` | ④ | 오브 시각화·CSS·표현 함수·Document PiP·스크롤 효과 |
| `app/page.tsx`, `app/demo/**`, `app/orb-preview/**` | ④ | 화면 route·조합 |
| `app/favicon.ico`, `public/*.svg` | ④ | 파비콘·앱 아이콘·시각 자산 |
| `tests/camera/**`, `tests/ui/**` | ①④ | 해당 소스의 동작 검증 |

rPPG는 현재 미구현이다. 향후 **`features/rppg/`**에 RGB 시계열 수집, 신호처리, BPM 추정, 측정 품질 판정을 둔다. RGB 수집부터 BPM·품질 값 산출까지 김우빈 담당이다.

② Electron은 현재 미구현이다. 향후 **`features/electron/`** 아래 `main/`, `preload/`, `window/`, `types/`를 필요할 때 만든다. main process·IPC·창·background·tray·always-on-top·lifecycle·Windows 실행·패키징·웹앱 연결은 김우빈 담당이다. 알고리즘은 Electron이 소비하며 Electron 폴더로 옮기지 않는다. 브라우저 Document PiP는 현재 UI 기능이다.

## 공동 — 통합 지점

| 파일/디렉터리 | 업무번호 | 이유 |
|---|---|---|
| `features/feedback/components/**` | ⑥ / ④ | 체크인·넛지 기능 컴포넌트. 조건·문구는 이정환, 시각 디자인은 김우빈 |
| `features/camera/hooks/useEmotionRecorder.ts` | ① / ③⑤ | 분석 주기 중심 통합 훅. 집계·저장 계약은 이정환 공동 검토 |
| `app/measure/**`, `app/stats/**` | ④ / 공동 | 카메라·저장·알고리즘·피드백과 UI의 통합 |

## 업무 경계

### Camera → Algorithm

김우빈의 `CameraView → faceDetection`이 얼굴·랜드마크·표정 확률을 얻는다. `faceDetection.analyzeEmotion`은 기존 `normalizeExpressions(raw: RawExpressions)`를 호출하고 `Promise<EmotionResult | null>`을 반환한다. 실제 raw 경계는 그 호출 인자다. `RawExpressions`의 happy/neutral/sad/angry/disgusted와 `EmotionResult`의 happy/calm/sad/angry는 `features/algorithm/emotion/emotionAnalysis.ts`에 한 번만 정의되어 있다.

이정환은 raw 이후 정규화·가중치·집계·스트레스/긍정·baseline·risk·상태 판정을 맡는다. 카메라 어댑터는 계산식을 소유하지 않는다. 레코더는 기존 호출 순서를 유지한 통합 훅이므로 옵션·반환값·주기·flush·저장 계약 변경 시 양쪽이 검토한다.

### rPPG → Analysis

RGB 수집부터 BPM·품질 값 산출까지 모두 김우빈이 맡는다. 이정환은 그 결과를 받아 추세·비교·피드백에만 쓰고, 별도 rPPG 알고리즘을 만들지 않는다. rPPG 결과 인터페이스는 아직 없다. 처음 만들 때 두 사람이 함께 정한다.

### Algorithm → UI

알고리즘이 계산 결과를 만들고 UI가 표시한다. `DailyReport`와 `TrendChart`는 기존 알고리즘 함수를 호출해 화면을 구성한다. `DailyReport`의 기존 `averageEmotion`은 대규모 리팩터링을 피하기 위해 그대로 두었다. 이 평균의 의미·가중치나 계산 호출 변경은 이정환이 함께 검토한다. `features/ui/report/**`의 계산 해석, `orbStages` 성장 임계값과 `orbCaption` 감정별 카피 선택의 판정 변경은 두 사람이 함께 검토한다.

### Feedback → UI

이정환은 **무엇을·언제·어떤 조건에서 보여주며 어떤 문구를 선택할지** 맡는다. 김우빈은 **레이아웃·색상·간격·반응형·애니메이션·시각적 상호작용**을 맡는다. feedback 컴포넌트의 위치가 시각 디자인 단독 소유를 뜻하지 않는다. 2026-10-07 재분류 당시에는 props·문구·스타일·조건을 유지하고 컴포넌트를 대규모 분해하지 않았다.

## 공동 영역 — shared conflict zone

| 경로 | 협업 기준 |
|---|---|
| `shared/storage/**` | 이정환 주 관리. DB schema·저장 키·데이터 계약 변경은 반드시 상대 팀원에게 공유한 뒤 진행 |
| `features/algorithm/emotion/emotionAnalysis.ts`, `shared/storage/db.ts` 및 feature 간 공개 타입·props·함수 | 기존 정의 재사용. 계약 변경 전 양쪽 사용처·mock·테스트 확인 |
| rPPG 결과 형식 (미정) | 처음 정의할 때 두 사람이 함께 정하고 작은 커밋으로 분리 |
| `features/camera/hooks/useEmotionRecorder.ts`, `app/measure/**`, `app/stats/**` | 카메라·알고리즘·저장·피드백·화면 통합 |
| `features/ui/report/**`, `features/feedback/components/**` | 계산·문구 의미와 시각 표현의 접점 |
| `features/ui/common/ServiceWorkerRegistrar.tsx`, `public/sw.js`, `public/manifest.json` | 등록 URL·캐시·PWA 계약 |
| `app/layout.tsx`, `app/globals.css` | 앱 전체 화면 틀·전역 스타일 |
| `package.json`, `package-lock.json` | 실행 명령·의존성 |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `tests/setup.ts`, `.gitignore` | 빌드·타입·스타일·테스트 설정 |
| `AGENTS.md`, `README.md`, `CLAUDE.md`, `GEMINI.md`, `.gemini/settings.json` | 에이전트 규칙·사용법·검토 환경 |
| `docs/collaboration/**`, `docs/architecture/**`, `docs/roadmap.md`, `docs/2026-1학기-정리.md` | 협업·구조·계획·학기 기록 |
| `.github/**`, `scripts/collaboration/**`, `tests/tooling/**`, `.node-version`, `.gitattributes` | Issue·PR·CI·설치·검사와 실행 환경 |

공동 관리란 목적과 영향을 공유하고 PR에서 상대 담당자가 검토하는 기준이다. 이미 합의된 범위의 파일 이동·import 수정마다 별도 승인 단계를 추가하지 않는다. GitHub 계정·리뷰 권한을 확인하지 않고 CODEOWNERS를 추정해 만들지 않는다.

## 보존 사항과 작업 원칙

1. 작업 전 현재 디렉터리·브랜치·`git status`와 이 문서를 확인한다. `main`을 직접 수정하거나 다른 작업 공간을 편집하지 않는다.
2. 한 작업 공간의 구현 에이전트는 하나, 한 브랜치의 업무도 하나로 유지한다. 상대 영역·공통 파일 변경은 구현 전에 작업 명세에 밝힌다.
3. 데이터 흐름은 camera 입력 → algorithm 계산 → feedback/UI의 결과 소비다. import 방향은 `app → features`, `camera/feedback/UI → algorithm`이다. 각 기능은 `shared/storage`를 사용한다. algorithm과 storage는 UI 컴포넌트·훅을 런타임 import하지 않는다.
4. 기존 교차 도메인 타입 참조는 type-only로 유지한다. 타입 공유를 이유로 불필요하게 파일을 쪼개거나 런타임 순환 의존성을 만들지 않는다.
5. `app/` route 위치와 `/models`, `/sw.js`, manifest·아이콘 URL을 유지한다. 모델 자산과 CSS 내용도 유지한다.
6. `features/feedback/components/RiskAlert.tsx`, `features/feedback/lib/notification.ts`는 기존 0바이트 파일이다. 별도 작업으로 지정되기 전에는 구현하지 않는다.
7. `docs/superpowers/**`는 당시 설계·계획이다. 현존 모듈의 경로 참조만 갱신하며 폐기된 기능·과거 동작은 현재 구현으로 간주하지 않는다. 현재 작업 지침은 AGENTS와 이 문서가 우선이다.
8. 구조 정리와 기능 변경을 섞지 않는다. 알고리즘·카메라·피드백·UI·schema·저장 키·의존성·테스트 기대값을 보존한다. 기존 recorder skip 4개를 유지한다.
9. 테스트는 소스와 대응하는 `tests/<업무>/...`에 둔다. 미구현 업무를 위해 빈 테스트 폴더를 만들지 않는다. 인계 전 `npm run check`, `npx tsc --noEmit`, `git diff --check`와 경로 검색 결과를 기록한다.
10. 새로 작성하거나 수정하는 주석·문서·PR·커밋 설명은 한국어로 쓴다. 세부 기준은 `AGENTS.md`의 한국어 작성 규칙을 따른다.
