import { runNpmSteps } from './runner.mjs'

process.exitCode = runNpmSteps([
  ['run', 'test:tooling'],
  ['run', 'test:run'],
  ['run', 'lint'],
  ['run', 'typecheck:electron'],
  ['run', 'build'],
], { check: true })
