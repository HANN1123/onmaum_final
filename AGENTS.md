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
