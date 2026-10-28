# Electron 데스크톱 앱 설계 (제안)

- 상태: **제안 · 일부 결정.** 2026-10-28 요청자(이정환)의 제품 결정으로 측정 소유 창과 최소화 정책이 정해졌다. 그 결정대로 구현한 PR #19(Draft)가 있고, 결정 내용은 **0.1절**에 모았다. 남은 `[합의 필요]` 항목은 표시한 결정 담당자가 정한다.
- 기준 커밋: `main` 1b4fdc6 (2026-10-24), 구현 반영: PR #19 `feat/electron-port` (2026-10-28)
- 작성: 이정환 (구현 에이전트 Claude Code) / 교차 검토: Codex / 검토 요청: 김우빈
- 관련 문서: 카메라 파이프라인 설계(PR #15, 병합 전 `docs/architecture/CAMERA_PIPELINE_DESIGN.md`), [세션·rPPG 데이터 설계](SESSION_DATA_DESIGN.md), [역할 분담](../collaboration/CODE_OWNERSHIP.md)

## 0. 요약

1. **실측으로 확인한다.** "창을 내려도 측정이 이어진다"는 Electron 전환의 전제다.
   - 처음에는 별도 스파이크(12절)를 구현보다 먼저 하자고 제안했다.
   - 실제로는 구현(PR #19)을 먼저 만들고, 그 패키지 앱으로 같은 조건을 실측하기로 바꿨다.
   - **실측 통과가 #19 Draft 해제 조건**이다(0.1절).
2. **측정은 메인 창이 계속 맡는다(5.1 후보 C, 결정).** 최소화해도 측정을 멈추지 않고, 투명한 표시 전용 오브 위젯이 측정 중임을 알린다.
   - 사용자가 위젯을 끌 수 있어야 하므로 위젯이 측정을 맡을 수 없다.
   - 처음 제안한 "오브 창이 측정 소유(A)"는 이 결정으로 쓰지 않는다.
3. **웹 앱은 정적 export해 `app://onmaum/`으로 싣는다.** 서버·포트가 없어 저장소 origin이 고정되고, 원격 코드도 받지 않는다.
4. **보안 기본값을 처음부터 지킨다.** `contextIsolation`·`sandbox` 켬, `nodeIntegration` 끔, preload는 기능별 함수만 노출, 카메라 권한은 자기 origin의 video만 허용한다.
5. **역할.** 설계는 이정환이 쓰고 김우빈이 검토한다. 구현 담당은 미정이다. 이 문서는 소유권 이전이 아니며, 영구 변경을 합의하면 그때 [CODE_OWNERSHIP.md](../collaboration/CODE_OWNERSHIP.md)를 함께 고친다.

## 0.1 결정 기록 (2026-10-28)

요청자(이정환)의 결정은 다음과 같다.
- Electron으로 바꾸는 이유는 창을 내려도 오브 같은 위젯을 띄워 측정 중임을 알리기 위해서다.
- 창을 내린다고 측정을 멈추지 않는다.
- 위젯은 설정에서 끌 수 있어야 한다.
- 지금 기능과 디자인을 모두 옮긴다.

| 항목 | 처음 제안 | 결정·구현 (PR #19) |
|---|---|---|
| 측정 소유 창 | A. 오브 창 (1순위 후보) | **C. 메인 창.** `/measure` 화면이 지금처럼 측정한다 |
| 최소화 | `[합의 필요]` | **측정 계속.** 메인 창의 `backgroundThrottling: false`는 창을 만들 때만 지정한다(#50250). 메인 창에 `hide()`를 쓰지 않는다(#31016) |
| 닫기 | 트레이로 숨김 | **앱 종료.** 트레이는 1차 범위 밖 |
| 오브 | 측정하는 항상 위 창 | **표시 전용 위젯 창**(`/widget/`): 투명 배경, 제목 표시줄 없음, 항상 위, 작업 표시줄에 안 보임. 측정 중 최소화하면 보이고 복원하면 숨는다. "열기" 버튼이 있고, 끌어서 옮기면 위치를 기억한다 |
| 위젯 설정 | — | "오늘" 화면의 "🫧 최소화 위젯" 켜기/끄기(기본 켬). `userData/desktop-settings.json`에 저장 |
| 위젯 상태 | — | 측정 중 / 측정 확인 필요 / 측정 꺼짐. "확인 필요"는 스냅샷 5초 끊김, 카메라 프레임 0이 5초, 저장 실패, 감정 결과 없음 30초 중 하나일 때 |
| 스파이크 | 구현 전 별도 실험 | 패키지 앱 실측 체크리스트로 대체(12절) |
| 알림 | 측정 창 → main | 지금처럼 웹 `Notification`. 측정하는 창이 메인 창 하나라 중복이 없다 |
| Document PiP 오브 | 유지 | Electron에서는 버튼을 숨긴다(웹은 그대로) |

**알려진 제한:**
- 측정은 `/measure` 화면이 맡으므로, 다른 화면으로 이동하면 측정이 끝난다. 측정을 앱 전역으로 옮기는 일은 별도 작업이다(6절의 컨트롤러, 14절 14).
- 이 결정은 제품 동작에 관한 것이다. 소유권(② Electron 김우빈)은 바꾸지 않으며, #19는 김우빈 리뷰를 받는다.

## 1. 범위

- **대상:** Windows 우선 데스크톱 앱. macOS·Linux는 이번 범위 밖이다.
- **하는 것:** 웹 앱 탑재, 최소화 중 측정, 표시 전용 오브 위젯, 알림, 설치본. 트레이와 로그인 시 자동 실행은 후속 작업이다(0.1절).
- **하지 않는 것:** 자동 업데이트(13절에서 수동 재설치 절차만 정함), 서버 연동, 관리자 기능, 웹 버전 폐기. 웹 앱(PWA)은 계속 유지하고 Electron은 같은 코드를 싣는다.
- **이 PR의 범위:** 문서만. 구현은 PR #19.

## 2. 현재 상태

| 구분 | 상태 | 근거 |
|---|---|---|
| 서버 기능 | Route Handler·Server Action·cookies·headers·`next/image` 없음. `next/link`·`usePathname`만 사용. 현재 `next build`에서 7개 경로가 모두 정적(○)으로 생성된다 | `app/**`, `features/ui/common/Navigation.tsx` |
| 측정 루프 | 화면 컴포넌트에 묶인 `setTimeout` 루프. 추론이 끝난 뒤 500ms를 기다려 실제 주기는 500ms보다 길다 | `app/measure/page.tsx:95`, `features/camera/hooks/useEmotionRecorder.ts:99`–`126` |
| 카메라 정리 | 측정 중 화면을 떠나면 track을 멈추지 않는다(PR #15에서 발견) | `features/camera/components/CameraView.tsx:52` |
| 세션 연결 | 세션 API는 있지만 측정 화면은 세션을 만들지 않는다. 정리 시 flush를 기다리지 않는다 | `shared/storage/sessionRepository.ts`, `useEmotionRecorder.ts:128` |
| 항상 위 오브 | 브라우저 Document PiP. 오브만 띄우고 분석은 원래 탭에 남는다 | `features/ui/hooks/useOrbPip.ts:33` |
| 알림 | 넛지를 판정한 창에서 브라우저 `Notification` 생성 | `features/feedback/hooks/useNudge.ts:53` |
| 서비스 워커 | 모든 환경에서 `/sw.js` 등록 | `features/ui/common/ServiceWorkerRegistrar.tsx:10` |
| 측정 중 판정 | 최근 기록·세션 갱신 시각으로 추정 | `shared/storage/personalData.ts:142` |
| 내보내기 | JSON 내보내기 있음, **가져오기 없음** | `shared/storage/personalData.ts:101` |
| 빌드 설정 | `tsconfig.json`이 `**/*.ts`를 모두 포함, CI는 Ubuntu만 | `tsconfig.json:25`, `.github/workflows/ci.yml` |

## 3. 핵심 전제: 백그라운드 측정

### 3.1 문서로 확인되는 것

- `webPreferences.backgroundThrottling: false`이면 창이 최소화·가림·숨김 상태여도 페이지 visibility가 `visible`로 유지되고, 백그라운드 타이머·애니메이션 제한이 풀린다(Electron BrowserWindow·WebPreferences 문서).
- 커스텀 scheme에서 IndexedDB를 쓰려면 `standard`로 등록해야 한다(Electron protocol 문서).

### 3.2 공개 보고만 있고 현재 버전에서 확인이 필요한 것

| 보고 | 내용 | 현재 판단 |
|---|---|---|
| electron/electron #31016 | Windows에서 `hide()`한 창은 `backgroundThrottling: false`여도 throttling | 관련 수정이 28 계열 릴리스 기록에 있다. 현재 버전 재현 여부 **검증 필요** |
| electron/electron #42378 | Windows 숨긴 창이 몇 분 뒤 비는 문제 | 수정 완료로 닫힘. 재발 여부만 스파이크에서 확인 |
| electron/electron #50250, PR #50264 | 최소화·가림 **도중** `setBackgroundThrottling(false)`를 호출하면 video가 복원 후에도 안 그려짐 | PR #50264는 2026-10-28 조회 시 미병합. 보고된 조건(실행 중 변경)을 피하도록 창 생성 시에만 설정하고, 고른 버전에서 다시 확인한다 |
| 가설 (출처 미정리) | 숨긴 페이지에서 rVFC가 멈추거나 줄어들 수 있고, 한 번도 보이지 않은 창은 프레임이 안 나올 수 있다는 개별 프로젝트 보고가 있다 | 근거로 쓰지 않고 **스파이크에서 확인할 가설**로만 둔다 |

### 3.3 그래서

- `backgroundThrottling`은 창을 만들 때만 정하고 실행 중에 바꾸지 않는다.
- "설정이 들어갔다"를 합격으로 보지 않는다. track이 `live`여도 프레임이 갱신된다는 보장은 없다. 실제 프레임 간격·분석 완료 횟수를 재야 한다.
- 처음부터 숨긴 측정 창은 1순위가 아니라 실험 조건 중 하나로만 둔다.
- 절전·화면 잠금 중 연속 측정은 약속하지 않는다. 이때 합격 기준은 "중단을 감지하고, 허위 기록을 남기지 않고, 복귀 후 합의한 재개 정책대로 동작하는 것"이다(12.5).

## 4. 앱을 싣는 방식

| 방식 | 장점 | 단점 | 판단 |
|---|---|---|---|
| (a) 정적 export + `app://onmaum/` | 서버·포트 없음, origin 고정, 오프라인 | export 동작·라우팅 확인 필요 | **권장** |
| (b) Next standalone 서버를 localhost로 | 서버 기능 사용 가능 | 서버 실행·포트 충돌·종료 관리. 포트가 바뀌면 다른 origin 저장소를 보게 된다 | 서버 기능이 필요해질 때 재검토 |
| (c) 배포된 원격 URL | 빌드 단순 | 네트워크·도메인 의존, 원격 코드 변경 위험 | 제외 |

- **등록:** `app` scheme을 `standard`, `secure`, `supportFetchAPI`로 등록한다(`app.ready` 전, 한 번만). `bypassCSP`는 켜지 않는다.
- **파일 제공:** `protocol.handle`로 `out/` 안의 파일만 돌려준다. 경로가 `out/` 밖으로 나가는 요청(`../`)은 거부한다. `trailingSlash: true`로 경로마다 `index.html`을 만들고, `/_next/`·`/models/`·라우팅용 정적 payload를 함께 제공한다.
- **확인할 것:** `output: 'export'` 빌드 성공, 직접 진입·새로고침·`next/link` 이동, 모델·Worker·WASM의 MIME. `output: 'export'`를 웹 배포에도 쓸지, Electron 빌드에서만 켤지는 `[합의 필요]`.
- **서비스 워커:** Electron에서는 등록하지 않는다. 자산은 패키지에 들어 있고, 캐시가 옛 파일을 내주면 업데이트가 꼬인다. 등록 여부는 Electron 감지(7.3) 결과로 정한다.
- **개발 실행:** 고정 포트(예: 3003)의 `next dev`에 연결한다. 포트가 사용 중이면 다른 포트로 옮기지 말고 실패시킨다(origin이 바뀌면 다른 저장소를 보게 된다). `app.isPackaged`로 분기해 패키지에서는 `app://onmaum/`만 허용하고 개발 URL 환경 변수는 무시한다.

## 5. 창 구조와 생명주기

### 5.1 측정 소유 창 후보 → **C로 결정 (0.1절)**

아래 표는 결정 전에 비교한 기록이다. 근거는 "위젯을 끌 수 있어야 한다"는 요구다.
- A는 오브를 끄면 측정도 끝난다.
- B는 3.2의 hide·never-shown 위험이 있다.
- C는 "메인 창을 닫으면 측정이 끝난다"는 단점이 있다. 닫기를 앱 종료로 정했으므로 이를 의도된 동작으로 본다.

| 후보 | 구조 | 장점 | 위험 |
|---|---|---|---|
| **A. 오브 창이 측정 소유 (1순위)** | 항상 위 오브 창(작은 `BrowserWindow`, `alwaysOnTop`)이 카메라·컨트롤러·Worker를 소유. 메인 창은 결과만 표시 | 측정 창이 숨겨지지 않음. 카메라 사용 중이 늘 보임 | 전체 화면 앱에 가렸을 때 동작 **검증 필요**. 오브 창 크기에서 face-api·WebGL 동작 확인 필요 |
| B. 숨긴 측정 전용 창 | 화면 없는 창이 측정, 메인·오브는 표시만 | 표시 창을 자유롭게 닫음 | 3.2의 hide·never-shown 위험 |
| C. 메인 창 하나 | 지금 웹 구조 그대로 | 단순 | 메인 창을 닫으면 측정도 끝남 |

- **A의 세부:** 오브 창은 메인 창과 독립이라, 메인 창을 닫아도 측정이 끝나지 않는다. 오브를 최소화하거나 닫으면 우선 **측정을 멈추는 정책**을 권장한다. backgroundThrottling에 기대어 계속 잴지는 스파이크로 정한다.
- **후보마다 "계속 재야 하는 조건"과 "의도적으로 멈추는 조건"을 먼저 나눈다.** 예를 들어 A는 메인 창 최소화·숨김 중 연속 측정을 평가하고, 오브 자체 최소화·닫기는 중단 정책이 제대로 동작하는지를 평가한다. 후보 선택은 각 정책별 기준(12.5)을 통과했는지로 정한다.
- `alwaysOnTop`의 `screen-saver` 같은 레벨은 창 순서 설정일 뿐 프레임 공급을 보장하지 않는다. 기본 `alwaysOnTop`부터 시험한다.
- 일반 전체 화면과 독점 전체 화면(게임)은 다른 조건으로 시험한다.

### 5.2 웹과 Electron의 정책 분리

PR #15(3.2)는 웹에서 "탭이 숨겨지면 세션을 끊는다"를 제안했다. Electron에서는 같은 컨트롤러를 쓰되 **숨김 정책만 다르게** 주입한다. Electron에서는 `backgroundThrottling: false` 때문에 visibility가 늘 `visible`이므로, 사용자에게 보이는지 여부를 visibility로 판단하지 않는다. 창 상태는 main 프로세스가 알려 준다.

### 5.3 생명주기

| 상황 | 동작 |
|---|---|
| 앱 실행 | 단일 인스턴스 잠금. 두 번째 실행은 기존 창을 앞으로 가져온다. 시작 시 측정은 **대기 상태**(자동 측정 안 함) |
| 메인 창 최소화 | **측정 계속.** 측정 중이면 위젯을 띄운다 (결정) |
| 메인 창 닫기 | **앱 종료** (결정. 트레이는 후속 작업) |
| 트레이 "종료" | 새 입력 차단 → 진행 중 추론 정리 → 감정 버퍼 flush → 세션 종료(`user-stop`) → track·Worker 해제 → 종료. 각 단계는 완료 응답을 기다리되 상한 시간을 둔다. 상한을 넘기면 정상 완료로 처리하지 않는다(6절) `[합의 필요: 상한값]` |
| 로그인 시 자동 실행 | 기본 꺼짐. 켜도 측정은 자동 시작하지 않는다. "자동 실행 동의"와 "자동 측정 동의"는 따로 묻는다 |
| 화면 잠금·시스템 절전 | `powerMonitor`의 `lock-screen`·`suspend`에서 측정을 멈춘다. 종료 사유(지금 `SessionEndReason`은 `user-stop`·`camera-error`·`recovered`뿐, `shared/storage/db.ts:20`), 복귀 시 새 세션을 만들지, 자동으로 다시 시작할지는 `[합의 필요: 공동, 저장 계약]`. suspend 이벤트 뒤 비동기 저장이 끝난다고 보장할 수 없으므로, 저장이 끝나지 않은 세션은 다음 실행 때 기존 세션 복구 절차(`recovered`)로 처리한다 |
| 모니터만 꺼짐 | 잠금·절전과 다른 조건이다. 감지 방법과 측정을 계속할지·멈출지는 스파이크로 확인한 뒤 정한다 |
| 절전 방지 | 측정 중에만 `powerSaveBlocker.start('prevent-app-suspension')`를 쓸지는 `[합의 필요]`. 써도 사용자가 직접 고른 절전까지 막는 것으로 해석하지 않는다 |
| 카메라 오류 | 무한 자동 재시도 대신 상태 안내와 "다시 시도" 버튼 |

## 6. 측정 상태와 창 사이 통신

- **상태의 주인은 측정 소유 창 하나.** main 프로세스는 명령을 중계하고 창 상태를 알린다. 다른 창은 스냅샷을 받아 표시만 한다.
- **#19 구현:**
  - 메인 창 `/measure`가 1초마다 `MeasurementSnapshot { active, emotions, recordCount, videoFps, saveFailed, sentAt }`을 보낸다.
  - main은 여기에 순번(`seq`), 수신 시각, 프레임이 없어진 시각, 감정 결과가 없어진 시각을 붙여 `WidgetView`로 위젯에 넘긴다.
  - 새로고침·문서 이동·renderer 종료는 main이 감지해 "측정 꺼짐"으로 바꾼다.
  - 아래 초안은 측정 컨트롤러를 만들 때 다시 정한다.
- **영상·프레임은 IPC로 보내지 않는다.** 결과 스냅샷만 보낸다.
- **스냅샷 초안** `[합의 필요: 공동]`:

```ts
interface MeasurementSnapshot {
  runId: string | null        // PR #15의 실행 번호
  sessionId: string | null
  seq: number                 // 스냅샷 순번. 늦게 도착한 옛 값을 버리는 데 쓴다
  state: 'idle' | 'starting' | 'measuring' | 'stopping' | 'error'
  emotion: EmotionResult | null
  heart: { bpm: number | null; status: string } | null  // RppgResult 합의 뒤 확정
  error: string | null
}
```

- **stop의 의미:** `measurement:stop`은 "flush와 세션 종료까지 끝났다"는 응답을 돌려준다. 상한 시간을 넘기면 정상 완료로 응답하지 않는다. 그때 저장 실패 안내, 자원 해제, 다음 실행 때 복구 방식은 `[합의 필요: 공동]`.
- **측정 창 장애:** main은 측정 창이 종료되거나 응답하지 않는 것을 감지하면 다른 창에 "측정 상태 확인 불가"를 알린다. 다른 창이 오래된 `measuring`을 계속 표시하지 않게 한다.
- **삭제·가져오기:** stop 완료 뒤 **새 측정 시작을 막은 상태에서** 실행한다. 다만 지금 `deleteAllPersonalData()`는 세션이 끝났어도 최근 2분 안에 감정 기록이 있으면 삭제를 거부한다(`shared/storage/personalData.ts:142`–`159`). 이 최근 기록 기반 차단과 명시적 stop 완료를 어떻게 연결할지는 저장소 공개 계약으로 따로 합의한다 `[합의 필요: 이정환 주도, 김우빈 사전 공유]`.
- **넛지 판정은 한 곳에서.** 지금 `useNudge`는 그 훅이 붙은 창마다 판정한다. 창이 여러 개면 알림이 중복될 수 있으므로, 판정은 측정 소유 창에서만 하고 알림은 main을 거쳐 한 번만 띄운다 `[합의 필요: 이정환 주도(⑥), 화면 연결은 김우빈]`.

## 7. 보안

### 7.1 창 설정

모든 창에 명시한다: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. 외부 탐색과 새 창(`will-navigate`, `setWindowOpenHandler`)은 기본 차단한다. 상담 전화(`tel:`)처럼 필요한 외부 링크만 확인 후 시스템에 넘긴다.

### 7.2 preload API

renderer에 Electron·Node API를 직접 노출하지 않는다. 범용 `send(channel, payload)`, 파일 경로 접근, 임의 URL 열기는 두지 않는다.

**#19에서 구현한 채널**은 `features/electron/types/bridge.ts`의 `CHANNELS`에 있다. 채널마다 허용 창, 최상위 프레임, 현재 URL을 검사하고 payload를 검증한다.

| 채널 | 방향 | 허용 창 |
|---|---|---|
| `onmaum:measurement:publish` | 메인 → main | 메인 |
| `onmaum:measurement:get` / `onmaum:measurement:update` | main ↔ 위젯 | 위젯 |
| `onmaum:widget:open-main` | 위젯 → main | 위젯 |
| `onmaum:settings:get` / `onmaum:settings:set-widget-enabled` | 메인 → main | 메인 |

처음 제안한 채널 초안(측정 컨트롤러·트레이·자동 실행용, 후속):

| 채널 | 방향 | 용도 |
|---|---|---|
| `desktop:get-capabilities` | 웹 → main | Electron 버전·지원 기능 |
| `measurement:start` / `measurement:stop` | 웹 → main → 측정 창 | 측정 시작·중지(완료 응답) |
| `measurement:get-state` / `measurement:state` | 양방향 | 스냅샷 조회·구독 |
| `orb:set-visible` | 웹 → main | 오브 창 표시 |
| `notification:show-nudge` | 측정 창 → main | 넛지 알림 1회 |
| `startup:get` / `startup:set` | 웹 → main | 로그인 시 자동 실행 |

main은 보낸 창·프레임·정확한 허용 URL·인자 형식을 검사한다.

### 7.3 Electron 감지

웹 코드는 preload가 노출한 `window.onmaumDesktop`(버전·capability 포함)이 있는지로 감지한다. User-Agent 문자열이나 웹 코드의 `import 'electron'`에 기대지 않는다. 브라우저에서는 이 객체가 없으므로 지금 동작 그대로다. 감지 어댑터는 쓰는 기능 가까이(UI는 `features/ui`, 알림은 `features/feedback`)에 두고, algorithm·storage는 Electron을 import하지 않는다.

### 7.4 권한·CSP

- `setPermissionRequestHandler`와 `setPermissionCheckHandler`를 모두 구현한다. 측정 소유 창의 자기 origin에서 오는 **video만** 허용하고 audio·화면 공유·그 밖의 권한은 거부한다.
- #19 구현:
  - 메인 창의 video·알림만 허용하고, `openExternal`은 상담 전화 `tel:`(허용 목록)에만 허용한다.
  - 알림 권한 확인은 Electron이 WebContents 없이 부르므로 앱 출처로 판정한다.
  - 위젯 창과 하위 프레임의 요청은 모두 거부한다.
- CSP는 `protocol.handle` 응답 헤더로 준다. Next의 inline script, Worker, WASM에 필요한 최소 허용 범위는 **검증 필요**.

## 8. 프레임 공급원 경계 (PR #15와의 접점) `[합의 필요: 김우빈 주도]`

숨긴 상태에서 rVFC가 멈출 가능성(3.2)에 대비해 "프레임을 어디서 얻는가"를 바꿔 끼울 수 있게 해 두자는 제안이다.

- **기본은 PR #15의 video + rVFC.** `MediaStreamTrackProcessor`(track에서 `VideoFrame`을 직접 읽음)는 스파이크에서 대안으로만 확인한다. 두 구현을 처음부터 제품에 넣지 않는다.
- **최소 계약 초안:**

```ts
interface FrameSample {
  runId: string
  seq: number
  frame: VideoFrame | HTMLVideoElement   // 형식은 합의
  timestampMs: number                    // performance.now() 기준으로 변환한 값
  timeSource: 'capture' | 'callback'
}
interface FrameSource {
  start(onFrame: (s: FrameSample) => void): void
  stop(): Promise<void>
}
```

- **어댑터가 책임질 것:** 시간축 변환(`VideoFrame.timestamp`를 그대로 캡처 시각으로 쓰지 않는다), 프레임 크기·방향·미러링 규칙, `VideoFrame.close()` 책임, 비동기 소비 시 복제, 대기열 상한과 누락 횟수 집계.
- Worker 타이머는 타이머 지연은 줄여도 새 프레임 공급을 대신하지 못한다.
- 영향: PR #15의 3.1·4.1·5.1절, 현재 `analyzeEmotion(videoEl)` 입력. 형식이 바뀌면 김우빈과 먼저 합의한다.

## 9. 코드 위치와 빌드 분리

- **위치:** [CODE_OWNERSHIP.md](../collaboration/CODE_OWNERSHIP.md)에 정한 `features/electron/{main,preload,window,types}`를 그대로 쓴다. 감정·rPPG 계산은 기존 feature에 남긴다.
- **분리:** main·preload는 별도 Electron tsconfig와 번들 진입점으로 빌드한다. 현재 루트 `tsconfig.json`은 `**/*.ts`를 모두 포함하므로 Next 타입 검사에서 Electron 코드를 제외해야 한다(공동 설정 파일 변경). bridge 타입은 Electron·Node 런타임 의존이 없는 타입만 둔다.
- **검사:** ESLint는 Node 환경용 설정을 따로 두고 Electron 산출물을 제외한다. Vitest는 웹(`happy-dom`)과 main(Node) 환경을 나눈다. 카메라·GPU 검증은 실제 Electron 실행으로 한다.

## 10. 패키징

- **도구:** electron-builder + 사용자별 NSIS 설치 권장. Forge도 가능하지만, Windows만 지원하고 Next 빌드 결과를 그대로 묶는 이번 범위에서는 builder가 단순하다 `[합의 필요]`.
- **버전:** 2026-10-28 조회 기준 최신 안정판은 45.1.0(Chromium 156)이다(공식 릴리스 페이지, npm `electron`의 `latest` 태그 모두 확인). #19는 electron 45.1.0과 electron-builder 26.18.0을 정확한 버전으로 고정했다. 3.2 항목은 이 버전으로 실측한다(12절).
- **포함 자산:** `out/`, Electron 산출물, face-api 모델(`/models`), 앞으로 들어올 ONNX·WASM·Worker 파일. Issue #12 계획에서는 `public/vendor/`를 Git에 넣지 않고 설치 단계 스크립트로 복사한다고 했다. 이전이 끝나면 vendor 자산의 준비 명령·실행 시점·export 결과 포함 여부를 확인하고, 설치본에 모델·WASM·Worker가 모두 들어가도록 빌드 절차와 패키징 목록을 정한다.
- **오프라인 확인:** 설치본을 네트워크를 끊고 실행해 모델 로딩·Worker URL·WASM MIME·추론을 확인한다. 다중 스레드 WASM을 쓰면 cross-origin isolation 요구도 **검증 필요**.
- **서명:** 서명하지 않은 설치본은 SmartScreen 경고가 뜬다. 서명해도 평판이 쌓이기 전에는 경고가 남을 수 있다. 팀 내부 배포는 미서명으로 하고, 외부 배포의 서명 정책은 따로 정한다.
- **업데이트:** 자동 업데이트는 범위 밖. 보안 업데이트가 필요하면 새 설치본을 배포하고 다시 설치하는 절차를 README에 적는다.
- **CI:** 기존 `npm run check`와 recorder skip 4개는 그대로 둔다. Electron 타입·단위 검사를 추가하고, Windows 패키징은 별도 CI job으로 둔다. 의존성·스크립트·lock 변경은 한 PR에 모은다.

## 11. 데이터

- **저장 위치:** Dexie·localStorage를 그대로 쓴다. 저장소는 Electron Session의 디스크 영역(기본 `userData` 아래)에 놓인다. 앱 이름·partition·origin을 고정한다.

| 실행 | origin | partition | 프로필 경로 |
|---|---|---|---|
| 패키지 | `app://onmaum/` | `persist:onmaum` | 기본 `userData` |
| 개발 | `http://localhost:3003` | `persist:onmaum-dev` | 개발용 `userData`를 따로 지정 |

  모든 창과 protocol handler가 같은 Session을 쓰는지 확인한다. 개발·패키지에 각각 표식 데이터를 넣고 서로 안 보이는지, 다시 실행해도 남는지 확인한다. (#19에서 확인: 데이터 폴더 분리, 재시작 뒤 localStorage·IndexedDB 유지)
- **브라우저 기록 옮기기:** 일반 브라우저와 Electron은 같은 URL이어도 저장소가 다르다. Chromium 프로필 파일을 복사하지 않는다. 기존 JSON 내보내기를 쓰고, **가져오기 기능을 새로 만든다**(이정환 ③, `feat/storage-personal-import`에서 구현). 가져오기는 schema 검증, 날짜 복원, 중복 처리, `active`로 남은 세션 정리를 포함하고, 측정을 멈춘 뒤에만 실행한다.
- **앱 삭제:** 기록은 기본 보존하고, 앱 안에 "전체 삭제"를 둔다. #19 설치본은 제거해도 `%APPDATA%\OnMaum`이 남는 것을 확인했다. 이대로 유지할지는 `[합의 필요]`(14절 13).
- **개인정보:** 원본 영상·RGB·BVP·개인 기록을 로그나 crash report에 넣지 않는다([SESSION_DATA_DESIGN.md](SESSION_DATA_DESIGN.md)의 최소 저장 원칙).

## 12. 스파이크: 숨김 측정 실험

> **2026-10-28 변경:** 측정 소유 창을 C로 정했으므로(0.1절), 별도 스파이크 대신 #19 패키지 앱으로 아래 조건 중 C에 해당하는 것을 실측한다. 합격 기준(12.5)은 그대로 쓴다.
>
> | 조건 | 상태 |
> |---|---|
> | 최소화 중 타이머가 느려지지 않음 | 자동 확인 (100ms 타이머가 2초에 20회 실행) |
> | **실제 카메라로 측정 중 최소화 10분 → 기록 저장·프레임 지속** (위젯 켬·끔 각각) | **사람 확인 필요 — #19 Draft 해제 조건** |
> | 다른 창으로 완전히 가림, 화면 잠금(Win+L), 절전 후 복귀 | 사람 확인 필요 |
> | 실패하면 | 8절 프레임 공급원 대안(`MediaStreamTrackProcessor`)이나 측정 전용 창(B)을 "결정 필요"로 다시 올린다 |
>
> `npm run electron:dev`는 10초마다 `[측정 진단] videoFps=… minimized=…`를 출력하므로 프레임이 이어지는지 볼 수 있다. 아래 12.1~12.6은 처음 제안한 스파이크 설계 기록이다.

### 12.1 방식

- 별도 브랜치에서 `spikes/electron-background/`에 **독립 package·lock·실행 방법**을 둔다. 루트 의존성·`npm run check`에 연결하지 않는다. 다만 루트 `tsconfig.json`이 하위 `.ts`를 모두 포함하므로, 루트 검사에서 이 폴더를 빼는 설정이 필요하다(공동 설정 변경으로 PR에 적는다).
- 결과(코드·설정·장치 정보·요약)는 PR로 검토한 뒤 저장소에 남긴다. 나중에 Electron 버전을 올릴 때 같은 실험을 다시 돌린다.
- 원본 영상은 저장하지 않는다. 타임스탬프·횟수·메모리만 기록한다.
- DevTools를 닫고 재고, 마지막에는 패키지 실행으로 한 번 더 잰다.

### 12.2 부하

1단계는 face-api 표정 분석(요청 2Hz) + 매 프레임 얼굴 영역 평균 RGB 계산이다. 이것은 **프레임 공급**을 확인하는 대용 부하이며, ONNX·Worker·GPU 부하를 대표하지 못한다. 최종 합격에는 실제 rPPG 파이프라인이 필요하다(김우빈 Issue #12 이후).

### 12.3 조건

측정 소유 창과 창 상태를 따로 바꾼다.

| 측정 소유 창 | 창 상태 |
|---|---|
| 오브 창(A) | 전경 / 메인 창 최소화·hide / 오브 최소화 / 다른 창에 가림 / 일반 전체 화면 영상 / 전체 화면 게임 |
| 숨긴 측정 창(B) | `hide()` / 처음부터 숨김(show 안 함) |
| 메인 창(C) | 전경 / 최소화 / 완전히 가림 |
| 공통 | hide/show·최소화/복원 반복, 화면 잠금(Win+L), 모니터 꺼짐, 절전 후 복귀 |

1차는 조건마다 5분 선별 실험을 하고, 후보와 경계 조건만 30분 실험한다. 1차에서는 `backgroundThrottling: false`만 쓰고, 실패한 조건에서만 Chromium 스위치(`disable-renderer-backgrounding`, `disable-background-timer-throttling`, `disable-backgrounding-occluded-windows`)를 하나씩 더한다.

### 12.4 기록하는 값

- 카메라가 협상한 FPS·해상도, 전경에서의 실제 처리율
- 새 프레임 처리 수와 간격(평균·p95·최대), 2초를 넘는 공백 횟수
- 표정 분석 요청 횟수와 실제 완료 횟수(따로 기록), 저장된 1분 기록 수
- 메모리 사용량, WebGL context loss
- 창 상태 변경 시각(main 프로세스 기준)

### 12.5 합격 기준 (잠정) `[합의 필요: 공동, 모두 미검증 수치]`

| 조건 | 기준 |
|---|---|
| 전경 (기준선) | 전경 처리율이 합의한 최소 처리율 이상이어야 아래 "전경 대비" 기준을 적용한다. 전경부터 느리면 백그라운드 문제가 아니라 부하 문제로 따로 본다 `[합의 필요: 최소 처리율, 김우빈과]` |
| 연속 측정이 목표인 조건 | 새 프레임 처리율이 전경의 95% 이상, 프레임 간격 p95 ≤ 100ms, 원인 모를 2초 초과 공백 0회, 표정 분석 완료가 전경의 90% 이상, 메모리 지속 증가 없음 |
| 의도적으로 멈추는 조건 (5.1에서 정한 것, 예: 오브 최소화·닫기) | 측정이 실제로 멈추고, 세션이 정상 종료되고, track이 해제된다 |
| 잠금·절전 | 중단을 감지하고, 중단 구간에 허위 기록을 남기지 않으며, 복귀 후 합의한 재개 정책(5.3)에 따라 대기하거나 새 측정을 시작한다 |
| 실제 rPPG 단계(후속) | 시간 기준 유효 비율 90% 이상, 전경 대비 감소 5%p 이하, Worker 대기열이 계속 늘지 않음. 품질 기준과 BPM 정확도는 김우빈의 센서 비교로 정한다 |

### 12.6 결과에 따른 결정

- 모니터만 꺼진 조건은 결과를 보고 "계속 잰다"와 "멈춘다" 중 어느 정책으로 평가할지 정한다.
- A가 연속 측정 조건(메인 창 최소화·숨김, 오브 창이 다른 창에 가려짐)과 의도적 중단 조건을 모두 통과하면 A로 간다. 전체 화면 조건은 다음 항목에 따라 따로 판단한다.
- A가 전체 화면 조건에서만 실패하면 "전체 화면 중에는 측정 일시 중지"를 제품 정책으로 둘지 검토한다.
- 모든 후보가 각자의 연속 측정 조건에서 실패하면 프레임 공급원 대안(8절)을 시험하고, 그래도 실패하면 "창을 띄워 둔 동안만 측정"으로 PC 전환 목표를 줄인다.

## 13. 진행 순서

| 순서 | 작업 | 담당 | 완료 조건 |
|---|---|---|---|
| 1 | 이 문서 검토·합의 | 공동 | 14절 항목마다 결정 또는 보류·결정 시점 기록 |
| 2 | ~~숨김 측정 스파이크~~ → #19 패키지 앱 실측 (12절 변경) | 이정환 | 최소화 10분 실측 통과 |
| 3 | 정적 export + `app://` + 보안 기본값 + 빌드 분리 | **#19에서 구현** | 패키지 자동 검증 28/28 |
| 4 | 측정 컨트롤러·세션 연결을 Electron 정책과 함께 (PR #15 순서 5와 맞춤) | 김우빈 주도, 공동 | stop 완료 응답, 빠른 재시작·종료 테스트. 루프 중복과 카메라 정리는 #20에서 먼저 고침 |
| 5 | 오브 위젯·알림 | **#19에서 구현** (트레이·자동 실행은 후속) | 위젯 흐름 자동 검증 18/18 |
| 6 | 설치본·Windows CI·가져오기 | 설치본은 #19, 가져오기는 이정환(`feat/storage-personal-import`), Windows CI는 후속 | NSIS 설치·제거 확인, 가져오기 테스트 |

프레임 공급원·생명주기 계약(8절, 6절)을 먼저 합의해 웹과 Electron 작업을 나란히 진행한다. 계약 변경이 필요한 부분은 김우빈과 별도 커밋으로 맞추고, 그 밖의 rPPG·UI 개발은 기다리지 않고 계속한다.

## 14. `[합의 필요]` 목록

| # | 항목 | 결정 담당 | 필요한 근거 | 결정 시점 | 실패 시 대안 |
|---|---|---|---|---|---|
| 1 | ~~측정 소유 창(A/B/C)~~ | **결정: C** (0.1절) | — | 2026-10-28 | 실측이 실패하면 12절 변경 표대로 |
| 2 | ~~오브 필수 여부~~ → 위젯은 선택(설정, 기본 켬). 전체 화면·잠금 시 동작은 미정 | 공동 (화면은 김우빈) | 실측 | #19 Draft 해제 전 | 측정 일시 중지 |
| 3 | 웹/Electron 숨김 정책 분리 방식 | 공동 | PR #15 3.2 | PR #15 합의 때 | 웹 정책 그대로 |
| 4 | 프레임 공급원 계약(형식·시간축·메모리·누락) | 김우빈 주도 | 스파이크, PR #15 | 컨트롤러 구현 전 | rVFC만 사용 |
| 5 | 스냅샷 형식, stop·flush 완료 의미, 종료 상한 시간과 초과 시 처리, 측정 창 장애 알림 | 공동 | — | 순서 4 전 | — |
| 5-1 | 잠금·절전 종료 사유, 복귀 시 새 세션·자동 재개 여부 | 공동 (저장 계약) | 스파이크 잠금·절전 조건 | 순서 4 전 | 측정 중지 후 사용자가 다시 시작 |
| 5-2 | 삭제·가져오기와 stop 완료·측정 시작 차단 연결 (`deleteAllPersonalData` 차단 조건) | 이정환 주도, 김우빈 사전 공유 | — | 순서 4 전 | 지금처럼 최근 기록 기반 차단 유지 |
| 6 | 넛지 판정 위치·알림 중복 방지 | 이정환 주도, 화면은 김우빈 | — | 순서 5 전 | 메인 창에서만 판정 |
| 6-1 | 스파이크 전경 최소 처리율, 모니터 꺼짐 정책 | 공동 | 스파이크 | 스파이크 30분 실험 전 | — |
| 7 | 실제 rPPG 합격 기준, 성능 저하 정책 | 공동 | Issue #12, 스파이크 | rPPG 이전 뒤 | PR #15 12.3 |
| 8 | 지원 Electron 버전·Windows·GPU 범위 | 공동 | 스파이크 | 스파이크 뒤 | — |
| 9 | `output: 'export'`를 웹 배포에도 쓸지 | 공동 (공동 설정) | export 빌드 결과 | 순서 3 전 | Electron 빌드에서만 켬 |
| 10 | 패키징 도구, 서명 정책 | 공동 | — | 순서 6 전 | electron-builder 미서명 |
| 11 | `powerSaveBlocker` 사용 여부 | 공동 | 스파이크 절전 조건 | 순서 5 전 | 쓰지 않음 |
| 12 | 구현 담당과 통합 순서 | 공동 | 이 문서 | 순서 1 | — |
| 13 | 앱 제거 시 사용자 데이터 유지 여부 | 공동 | #19 설치본 확인(지금은 유지) | #19 병합 전 | 유지 |
| 14 | 측정을 `/measure` 화면 밖(앱 전역)으로 옮길지 | 공동 (김우빈 주도) | 0.1절 제한 | 순서 4 | 지금처럼 화면이 소유 |

**이정환이 혼자 정해도 되는 것:** 문서 구성, 근거 정리, 실험표·로그 형식, 스파이크 내부 구성. 단 공개 계약·공동 설정·제품 동작은 바꾸지 않는 범위다.

## 참고 자료

- Electron 공식 문서: [BrowserWindow (page visibility)](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility), [WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences), [protocol](https://www.electronjs.org/docs/latest/api/protocol), [Session](https://www.electronjs.org/docs/latest/api/session), [보안 지침](https://www.electronjs.org/docs/latest/tutorial/security), [알림](https://www.electronjs.org/docs/latest/tutorial/notifications), [powerSaveBlocker](https://www.electronjs.org/docs/latest/api/power-save-blocker), [powerMonitor](https://www.electronjs.org/docs/latest/api/power-monitor), [systemPreferences](https://www.electronjs.org/docs/latest/api/system-preferences), [setAlwaysOnTop](https://www.electronjs.org/docs/latest/api/base-window#winsetalwaysontopflag-level-relativelevel), [릴리스](https://releases.electronjs.org/)
- Electron 이슈: [#31016](https://github.com/electron/electron/issues/31016), [#42378](https://github.com/electron/electron/issues/42378), [#50250](https://github.com/electron/electron/issues/50250), [PR #50264](https://github.com/electron/electron/pull/50264)
- 프레임 처리: [W3C MediaStreamTrack Insertable Media Processing](https://www.w3.org/TR/mediacapture-transform/), [Chrome WebCodecs 영상 처리](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)
- 패키징: [electron-builder Windows](https://www.electron.build/docs/win/), [Electron Forge](https://www.electronforge.io/core-concepts/why-electron-forge), [SmartScreen 평판](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- Next.js 16 정적 export: `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`
