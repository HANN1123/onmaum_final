<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Collaboration

This repository is developed by two contributors using AI coding agents.

Before modifying code, read:

`docs/collaboration/CODE_OWNERSHIP.md`

Respect domain boundaries and avoid unrelated changes outside the current task.

Do not modify `main` directly.

Do not perform unrelated refactors while implementing an issue.

Shared files such as package.json, package-lock.json, app/layout.tsx,
app/globals.css, and project configuration require extra care because
they are common conflict points.

## Team Ownership

### Jung-hwan Lee

- ③ 개인 데이터 관리
- ⑤ 감정 및 개인 상태 분석
- ⑥ 개인 맞춤 피드백
- Shared storage primary maintainer; coordinate schema changes.

### Woo-bin Kim

- ① 카메라·rPPG (rPPG 신호처리 전체 포함)
- ② Electron
- ④ UI/UX

관리자 페이지와 조직·직원 관리는 현재 개발 범위에서 제외한다.

Before editing a feature owned by the other contributor,
check `docs/collaboration/CODE_OWNERSHIP.md`.

Avoid unrelated changes outside the current Issue.

Cross-domain changes should be explicitly reported before implementation.

## Orca workflow

Read `docs/collaboration/ORCA_WORKFLOW.md` when starting or handing off work.
Use one implementation agent per worktree and one task per branch. Check the
current directory, branch, and git status before editing. Never edit another
worktree to deliver a change; share commits or a PR instead.

Use `npm run setup:workspace` for a fresh checkout. Use `npm run check` before
handoff; it runs tooling tests, application tests, lint, and build sequentially.
Keep node_modules and .next separate for each worktree. Preserve the four existing
skipped recorder tests unless the task explicitly fixes those tests.

Read-only reviews should report findings without rewriting the implementation.
State shared-file and public-contract changes in the task brief and PR. Preserve
already authorized scope; do not add an approval step for routine implementation.

## 한국어 작성 규칙

이 규칙 이후 **새로 작성하거나 수정하는** 다음 항목은 한국어로 쓴다.

- 코드 주석, JSDoc, 알고리즘 설명
- 문서, Issue, PR 제목·본문
- 커밋 메시지 설명부, 테스트 설명
- 오류 분석, 작업 보고
- 새 사용자 표시 문구

다음 항목은 영어를 유지한다.

- 변수·함수·클래스·타입명
- 파일·폴더명
- 라이브러리 API, 환경 변수
- Git 명령
- Conventional Commit 접두어(`feat`, `fix`, `docs`, `refactor`, `test`, `chore`)

```text
feat: 개인 심박 기록 저장 기능 추가
docs: 협업 규칙에 한국어 작성 기준 추가
```

기존 영어 주석, 기존 UI 문구, 기존 테스트 이름은 수정하는 김에 일괄 번역하지 않는다.
이 문서의 기존 영어 지침도 의미가 바뀌지 않는 한 그대로 둔다.

## 브랜치·커밋 규칙

- `main`에는 직접 커밋하지 않는다. 모든 변경은 PR로 병합한다.
- 브랜치 이름은 `<type>/<issue번호>-<업무>-<요약>` 형식으로 쓴다.
  예: `feat/12-rppg-measurement`, `feat/15-storage-session-export`.
  Issue가 없으면 번호를 빼고 `feat/rppg-measurement`처럼 쓴다.
- 작업 흐름: `origin/main`에서 분기 → 구현 → `npm run check`, `npx tsc --noEmit`,
  `git diff --check` → 커밋 → push → PR → 상대 팀원 리뷰 → 병합.
- 금지: force push, `git reset --hard`, 다른 사람 브랜치에 push, 임의 파일 삭제,
  AI 리뷰만으로 자동 병합.
