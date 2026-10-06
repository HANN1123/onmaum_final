import { runNpmSteps } from './runner.mjs'

process.exitCode = runNpmSteps([['ci', '--no-audit', '--no-fund']], { setup: true })
