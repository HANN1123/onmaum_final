# 온마음 (ONMAUM)

콜센터 등 감정노동자가 웹캠 표정으로 자기 마음 상태를 기록하는, 프라이버시 우선 웹앱입니다.

서버·계정 없이 브라우저에서만 동작하며, 기록은 기기 안(IndexedDB·localStorage)에만 남습니다. 의료 진단이 아니라 자기 인식을 돕는 도구입니다.

## 방향

자세한 방향은 [docs/roadmap.md](docs/roadmap.md)에 있습니다.
1학기 정리: [docs/2026-1학기-정리.md](docs/2026-1학기-정리.md)

1. 카메라 기반 인식 고도화 — DeepMedi류 rPPG/심박 참고, 웹캠 신호 안정화
2. Electron — 브라우저 PWA 대신 PC 앱, 백그라운드(숨김 창)에서도 측정 가능
3. 서버 연동 · 관리자 페이지 — 옵트인 · 로컬 우선. 원본은 기기 유지, 서버에는 동의한 하루 단위 요약만. 기본은 팀 익명 집계, 개인별 열람은 본인이 「케어 담당과 공유」를 켠 경우만
4. UI 변경 — 세부 톤은 추후 확정
5. 감정 분석 알고리즘 체계화 — 규칙·임계값·단계(로컬 점수 → 필요할 때만 AI)를 문서/코드로 고정
6. 피드백 — 기본 AI 조언 사용하되, 스트레스 지수를 의사처럼 단정하지 말 것. “컨디션 신호 / 참고용” 프레임. 의료·진단 뉘앙스 금지.

## 왜 만들었나

감정노동자는 업무 중 표정을 관리하기 때문에, 본인도 자신의 부담을 놓치기 쉽습니다. 온마음은 **본인만** 보는 기록으로 “오늘은 평소보다 얼마나 힘들었는지”를 보여 주는 게 목표입니다. 데이터는 서버로 올리지 않고, 회사 대시보드용 모니터링이 아닙니다. **의료기기가 아닙니다.**

## 하는 일

통화나 업무 중 전면 카메라로 표정을 읽고, 4가지 감정(기쁨·평온·슬픔·화남) 분포를 1분 단위로 모읍니다. 하루 동안의 긍정 지수와 스트레스 지수를 보여 주고, 최근 14일 개인 기준선과 비교한 “평소 대비” 상태를 표시합니다. 푸터에 상담 전화(1577-0199, 1393)를 둡니다.

측정은 **전화 시작**을 누른 동안에만 돌아갑니다. 탭을 내리거나 백그라운드로 두면 브라우저 제약으로 측정이 느려지거나 멈출 수 있습니다.

## 화면별 요약

| 경로 | 하는 일 |
|---|---|
| `/` | 소개 랜딩, 첫 측정 전 4단계 설문 |
| `/measure` | 웹캠 측정, 실시간 오브·감정 막대, 전화 시작/종료 |
| `/stats` | 오늘 리포트 — 긍정/스트레스 2축, 기준선, 차트 |
| `/demo`, `/orb-preview` | 개발·미리보기용 (일반 사용 경로 아님) |

## 주요 기능 (현재)

- **측정** — 웹캠 표정 분석, 1분 자동 저장
- **오늘 리포트** — 긍정/스트레스 2축, 14일 개인 기준선
- **체크인 보정** — 오전·오후 자기보고로 스트레스 표시를 소폭 조정
- **옵트인 넛지** — 기본 꺼짐. 권한 허용 시 인앱 배너·브라우저 알림
- **Document PiP 오브** — Chrome/Edge 등 지원 시 작은 오브 창 (분석 루프는 원래 탭에 남음)
- **PWA** — 홈 화면 설치, `public/models/`에서 얼굴 인식 모델 서빙
- **상담 전화 안내** — 1577-0199, 1393

## 실행 방법

Claude와 Codex를 사용하는 팀 작업은 [Orca 협업 가이드](docs/collaboration/ORCA_WORKFLOW.md)를 따릅니다.
Node 버전은 `.node-version`을 기준으로 맞춥니다.

```bash
npm run setup:workspace # lock 파일 기준 설치
npm run dev          # http://localhost:3000
npm run test:run     # 단발 테스트
npm run check        # 도구 테스트 → 앱 테스트 → lint → build
npm run build && npm start
```

환경 변수는 없습니다. 카메라는 HTTPS(또는 localhost)와 권한 허용이 필요합니다. 얼굴 인식 가중치는 `public/models/`에서 서빙되며 합계는 약 6.5MB입니다.

테스트 (최근 확인 기준): 파일 30개, **139 passed / 4 skipped**. 레코더 통합 테스트 일부는 아직 `skip`입니다.

배포 예: [https://onmaum.vercel.app](https://onmaum.vercel.app) (Vercel). 별도 서버·API 키 없음.

## 기술 스택

| 구분 | 내용 |
|---|---|
| 앱 | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, Pretendard |
| 얼굴 인식 | face-api.js (SSD MobileNet + Landmark 68 + Expression) |
| 저장 | Dexie (IndexedDB), localStorage (프로필·설정) |
| 차트 | Recharts |
| 테스트 | Vitest, happy-dom, fake-indexeddb |

## 폴더 구조 요약

```
app/            라우트 — /, /measure, /stats, /demo, /orb-preview
components/     common, landing, measure, onboarding, orb, nudge, report
hooks/          emotion, checkin, nudge, ui
lib/            emotion, stress, storage, checkin, orb, nudge
public/         PWA(manifest, sw.js), face-api 모델
tests/          도메인별 Vitest 테스트와 tooling/ 협업 도구 테스트
docs/           architecture, collaboration, 기존 설계 스펙·구현 계획
```

전체 파일 구조와 이동 경로는 [프로젝트 구조](docs/architecture/PROJECT_STRUCTURE.md),
담당 영역과 공동 관리 기준은 [코드 소유권](docs/collaboration/CODE_OWNERSHIP.md)을 참고합니다.
비어 있는 `components/RiskAlert.tsx`, `lib/notification.ts`는 원래 위치에 보존했습니다.

데이터 흐름: `CameraView` → `useEmotionRecorder`(약 0.5초 분석) → 1분 `aggregate` → Dexie `emotions` → `/stats`에서 스트레스·기준선·보정 후 리포트.

설계 세부(알고리즘, Electron 창 구조 등)는 `docs/`를 보세요. README는 “무엇이 실제로 돌아가는지”만 적습니다.

## 한계와 주의

- **의료기기가 아닙니다.** 진단·치료 목적이 아니며, 자기 인식 보조에 가깝습니다. 도움이 필요하면 정신건강위기상담전화 **1577-0199**, 자살예방상담전화 **1393**(24시간)을 이용해 주세요.
- 표정만으로 마음 상태를 추정합니다. 조명, 각도, 말하기, 미검출 구간에 따라 값이 흔들릴 수 있습니다. 감정노동자가 업무 중 표정을 관리하면 부담이 과소평가될 수 있습니다.
- 기록은 암호화·잠금 없이 브라우저 저장소에만 있습니다. 공용 PC에서는 OS 계정 분리가 사실상 경계입니다.
- 백그라운드·다른 탭에서는 측정이 보장되지 않습니다. PiP는 오브만 띄우고, 분석 루프는 원래 탭에 남습니다.

## 로드맵 (계획 · 미구현)

아직 코드에 없거나 방향만 정한 항목입니다. 기대한 기능처럼 쓰지 마세요.

### 다음에 손댈 순서

1. **통화 단위 기록 (확정)** — “전화 시작~종료”를 한 세션으로 묶어 통화별 요약·당일 피로 시작 시점 표시
2. **Electron 숨김 측정 실험 (선행)** — Windows에서 창을 내려도 카메라 측정이 이어지는지 확인. 실패하면 PC 전환 전제를 다시 검토
3. **UI 선택** — 통화 후 체크인 시트 + 통화 카드 타임라인을 기본으로, 오브/가장자리 빛/트레이는 선택 모드로 검토

### 그다음 검토

- **Electron PC 프로그램 · 항상 위 오브 (방향)** — 웹 PWA 대신 Windows 우선 데스크톱
- **바우처 안내 (계획)** — 정신건강 심리상담 바우처사업 등 공식 안내·링크
- **카메라 심박(rPPG) (참고용 추세)** — 제품 핵심이 아니라 참고용. 통화 중 HRV는 신뢰도 낮음
- **음성 (계획)** — 개인용은 본인 운율만, 회사 도입 시에만 고객 음성·STT 확장 검토

## 라이선스

내부 학습·팀 프로젝트. 별도 라이선스 미지정.
