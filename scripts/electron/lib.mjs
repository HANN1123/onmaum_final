// Electron 개발·빌드 스크립트 공용 함수. Windows 기본 npm shell에서도 동작하도록 셸을 거치지 않는다.
import { spawn, spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)))
const require = createRequire(join(root, 'package.json'))

export const nextBin = require.resolve('next/dist/bin/next')
export const tscBin = require.resolve('typescript/bin/tsc')

/** node로 스크립트를 실행하고 끝날 때까지 기다린다. 실패하면 종료 코드와 함께 던진다. */
export function runNode(script, args, { env } = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (r.status !== 0) {
    throw new Error(`${script} ${args.join(' ')} 실패 (종료 코드 ${r.status ?? r.signal})`)
  }
}

export function startNode(script, args, { env } = {}) {
  return spawn(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
}

/** 자식 프로세스와 그 하위 프로세스까지 정리한다. */
export function killTree(child) {
  if (!child || child.exitCode !== null || child.pid === undefined) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    try {
      child.kill('SIGTERM')
    } catch {
      // 이미 끝남
    }
  }
}

export function compileElectron() {
  runNode(tscBin, ['-p', 'tsconfig.electron.json'])
}
