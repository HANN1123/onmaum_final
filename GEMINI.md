# ONMAUM Gemini review context

@./AGENTS.md
@./docs/collaboration/CODE_OWNERSHIP.md
@./docs/collaboration/ORCA_WORKFLOW.md

Gemini is an optional reviewer in this collaboration setup. Start the interactive
CLI with `gemini --approval-mode=plan` for review work. Stay in Plan Mode, report
findings in Korean, and do not edit project files or implement a proposed fix
unless the user assigns an implementation task. Do not exit Plan Mode merely
to complete a review. A review may conclude with no findings.

For a review, establish the target branch/commit and comparison base before
examining a supplied diff. The default Plan policy can block shell commands;
ask the operator for a diff made in a normal terminal when needed. Do not switch
a checkout that another agent is using. Cite file paths and evidence,
distinguish verified issues from suggestions, and state which checks were
actually run.
