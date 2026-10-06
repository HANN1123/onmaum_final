# Orca 협업 가이드

이정환과 김우빈이 Claude Code와 Codex CLI를 이용해 온마음을 병렬 개발하는 운영 기준입니다. 기능별 책임은 [CODE_OWNERSHIP.md](CODE_OWNERSHIP.md)를 따릅니다.

## 기본 구성

| 작업 공간 | 기본 에이전트 | 역할 | 개발 서버 |
|---|---|---|---|
| ONMAUM - Integration | 필요할 때 검토 에이전트 하나 | 기준 코드, 통합 확인, 교차 리뷰 | `npm run dev` → 3000 |
| ONMAUM - Core | Codex | 이정환의 분석·계산·저장 영역 | `npm run dev:core` → 3001 |
| ONMAUM - UI | Claude Code | 김우빈의 화면·상호작용 영역 | `npm run dev:ui` → 3002 |

이 배치는 작업을 나누기 위한 기본값이며 특정 모델의 성능 우열을 뜻하지 않습니다. 두 사람 모두 필요에 따라 Claude와 Codex를 바꿔 사용해도 됩니다. 한 작업 공간에서 수정하는 에이전트는 동시에 하나만 둡니다.

Orca의 작업 공간·터미널·로그인은 PC별 상태입니다. 이 PC에서 만든 작업 공간이 팀원의 PC에 자동 생성되지는 않습니다. 팀원과 코드는 GitHub 브랜치·PR로 공유하고, 각자 자신의 Claude·ChatGPT 계정으로 로그인합니다. 인증 파일이나 API 키를 저장소로 공유하지 않습니다.

현재 준비 기준 브랜치는 `chore/orca-collaboration`입니다. 앞선 도메인 재분류 커밋을 포함합니다. 원격 `main`에 협업 설정이 반영되기 전까지 새 작업 공간은 이 준비 기준을 사용합니다. 원격 공유 저장소 선택·초대·보호 규칙은 실제 GitHub 설정과 별도로 확인합니다.

## 설치와 검사

Node는 `.node-version`의 22.20.0을 기준으로 합니다. 설치된 npm을 사용하며 검증 환경은 npm 11.6.2입니다. 애플리케이션 직접 의존성 버전은 이번 설정에서 변경하지 않았습니다. 기존 lock 파일의 누락된 선택 의존성을 보완해 새 작업 공간에서 `npm ci`를 사용할 수 있게 했습니다.

각 작업 공간의 루트에서 실행합니다.

```bash
npm run setup:workspace
npm run check
```

`setup:workspace`는 현재 작업 공간에서 `npm ci --no-audit --no-fund`를 실행합니다. 기존 `node_modules`를 다시 설치하므로 개발 서버를 멈추고 사용합니다. 다른 작업 공간과 `node_modules`, `.next`를 공유하거나 연결하지 않습니다.

`check`는 도구 테스트 → 앱 테스트 → lint → build를 순서대로 실행하고 첫 실패에서 멈춥니다. 기본 테스트 작업자 수는 2이며 `VITEST_MAX_WORKERS`로 조정할 수 있습니다. 기존 레코더 테스트의 skip 4개는 기능 수정 작업 전까지 유지합니다. 메모리 사용량이 크면 여러 작업 공간의 전체 검사를 동시에 돌리지 않습니다.

## Orca에서 새 작업 시작

먼저 실제 등록된 저장소와 작업 공간을 확인합니다.

```bash
orca repo list --json
orca worktree list --repo name:onmaum_final --json
```

저장소 이름이 다른 PC에서는 `name:onmaum_final` 대신 해당 저장소의 `id:<repoId>`를 사용합니다. 작업 공간 생성과 관리는 Orca의 명령을 사용합니다.

일반 기능 작업은 다음처럼 독립된 작업 공간을 만듭니다. `--no-parent`는 작업 계보를 분리하며 Git 기준은 저장소의 기본 base ref를 따릅니다.

```bash
orca worktree create --repo name:onmaum_final --name core-task-name --no-parent --agent codex --setup skip --json
orca worktree create --repo name:onmaum_final --name ui-task-name --no-parent --agent claude --setup skip --json
```

생성 결과의 전체 worktree id와 터미널 handle을 사용합니다. 이미 `--agent`로 시작한 에이전트를 다시 만들지 않습니다. 설치는 해당 작업 공간의 별도 일반 터미널에서 `npm run setup:workspace`를 실행합니다. 현재 구성은 자동 setup hook에 의존하지 않으므로 새로 만든 작업 공간은 이 설치가 한 번 필요합니다.

터미널에서 `claude`, `codex`가 인식되고 로그인되어 있어야 합니다. 로그인은 각 사용자 PC에서 수행합니다.

```bash
claude auth status
codex login status
```

Claude Code는 `CLAUDE.md`의 `@AGENTS.md`와 담당 문서를 읽고, Codex는 `AGENTS.md`에서 공통 작업 규칙을 읽습니다. 개인 전역 모델·권한 설정은 이 저장소 설정으로 덮어쓰지 않습니다.

## 작업 전달과 교차 검토

1. Issue 또는 [TASK_BRIEF.md](TASK_BRIEF.md)를 이용해 담당자, 목표, 변경 경로, 완료 조건을 정합니다.
2. 작업자가 현재 디렉터리·브랜치·`git status`를 확인한 뒤 자신의 작업 공간에서 구현합니다.
3. 공유 타입·props·함수·저장 계약이 필요한 작업은 계약 변경을 먼저 작은 커밋으로 정리해 상대 작업이 어떤 기준을 사용하는지 명시합니다. 다른 사람의 작업 공간에 직접 파일을 써서 전달하지 않습니다.
4. 구현 에이전트와 다른 에이전트로 diff를 읽기 전용 검토합니다. 예: Codex가 구현한 Core 변경을 Claude가 검토하고, Claude가 구현한 UI 변경을 Codex가 검토합니다.
5. `npm run check`와 `git diff --check` 결과, 남은 위험, 화면 변경 확인 결과를 PR에 기록합니다.
6. 상대 담당자가 PR을 확인하고 통합합니다. AI 리뷰 결과만으로 자동 병합하지 않습니다.

검토 프롬프트 예시:

```text
AGENTS.md와 docs/collaboration/CODE_OWNERSHIP.md를 읽어라.
지정한 기준 커밋 대비 현재 변경을 읽기 전용으로 검토해라.
동작 오류, 회귀, 저장 schema/키 변경, 타입 계약과 호출부 불일치,
담당 영역 밖 변경을 우선 확인하고 파일 경로와 근거를 제시해라.
코드는 수정하지 말고, 실행한 검증과 실행하지 않은 검증을 구분해라.
```

Orca에서 자동 작업 분배·메시지·완료 대기까지 운영할 때는 설치된 `orchestration` 스킬을 별도로 사용합니다. 이번 기본 환경은 두 작업 공간과 수동 작업 지정 방식이며 상시 실행하는 자동 조정자는 만들지 않았습니다.

## GitHub로 두 사람 연결

현재 로컬 `origin`은 `HANN1123/onmaum_final`, 원본 코드는 `woobin-01/onmaum`에서 가져왔습니다. 공유 기준 저장소를 정한 다음 그 저장소로 준비 브랜치를 게시합니다. 이 설정 작업은 원격 URL을 바꾸거나 코드를 자동 업로드하지 않습니다.

GitHub CLI를 사용할 때는 본인 계정으로 `gh auth login`을 완료합니다. 다른 Git 인증 도구를 사용해도 됩니다. 새 저장소와 기존 `main`이 있는 저장소의 초기 게시 절차는 다르므로, 첫 게시 전 원격 브랜치를 확인합니다.

```bash
git remote -v
git ls-remote --heads origin
```

기존 `main`이 있다면 준비 브랜치를 올려 PR로 합칩니다. 비어 있는 저장소라면 기준 브랜치 게시·기본 브랜치 설정을 먼저 완료합니다. 기준 `main`이 준비되면 각자 다음 순서로 Orca의 기본 base ref를 바꿉니다.

```bash
git fetch origin
orca repo set-base-ref --repo name:onmaum_final --ref origin/main --json
```

그 후 새 작업은 최신 `origin/main`에서 생성합니다. 이미 작업 중인 브랜치는 상대 변경을 확인한 뒤 통합하며 다른 사람의 브랜치에 강제 push하지 않습니다.

추가한 `.github/workflows/ci.yml`은 PR, `main`과 준비 브랜치 push, 수동 실행에서 설치·전체 검사를 수행합니다. GitHub에 게시되기 전에는 원격 실행되지 않습니다. 관리자가 저장소 설정에서 `Tests, lint and build` 검사를 필수로 지정하고 상대 리뷰 1개를 요구하면 됩니다. 팀원 초대와 보호 규칙은 이 파일 자체로 활성화되지 않습니다.

## 추가 AI 도입 기준

먼저 Claude와 Codex의 구현·교차 검토를 사용합니다. 추가 도구는 아래 문제가 실제로 생길 때 도입합니다.

- 독립적인 세 번째 검토가 필요하면 [Gemini CLI](https://geminicli.com/docs/)의 [Plan Mode](https://geminicli.com/docs/cli/plan-mode/)를 검토용으로 고려합니다.
- PR 리뷰가 밀리면 [CodeRabbit](https://docs.coderabbit.ai/guides/code-review-overview)의 자동 PR 리뷰를 검토합니다. 저장소 접근 설정은 팀이 도입을 결정한 뒤 수행합니다.
- 말씀하신 Jev가 [TypeSafe의 Jev](https://docs.typesafe.ai/introduction)라면 구조화 판단·분류용 모델입니다. Orca에서 코드 작성·리뷰를 분담하는 현재 구성에 필수인 도구는 아닙니다. 앱 내 판단 기능을 실험할 때 별도로 검토합니다.

## 공식 참고

- [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Claude Code 프로젝트 메모리](https://code.claude.com/docs/en/memory)
- Orca 설치 버전에 맞는 명령: `orca skills get orca-cli --json`
