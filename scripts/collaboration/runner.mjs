import { spawnSync } from 'node:child_process'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { constants } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = realpathSync(fileURLToPath(new URL('../../', import.meta.url)))

export function runNpmSteps(steps, { setup = false, check = false } = {}) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 22) {
      throw new Error('Node.js 22 or newer is required for the collaboration commands.')
    }
    if (realpathSync(process.cwd()) !== repositoryRoot) {
      throw new Error('Run this command from the root of this onmaum worktree.')
    }
    const project = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'))
    if (project.name !== 'onmaum') {
      throw new Error('Expected the onmaum package at the current worktree root.')
    }
    if (!process.env.npm_execpath) {
      throw new Error('npm_execpath is missing. Run through npm run setup:workspace or npm run check.')
    }
    if (setup) {
      const modules = lstatSync(join(repositoryRoot, 'node_modules'), { throwIfNoEntry: false })
      if (modules?.isSymbolicLink()) {
        throw new Error('node_modules must belong to this worktree; shared symlinks or junctions are not supported.')
      }
    }

    const env = { ...process.env }
    if (check) {
      const workers = env.VITEST_MAX_WORKERS ?? '2'
      if (!/^[1-9]\d*$/.test(workers) || !Number.isSafeInteger(Number(workers))) {
        throw new Error('VITEST_MAX_WORKERS must be a positive integer, such as 2.')
      }
      env.VITEST_MAX_WORKERS = workers
    }

    for (const args of steps) {
      console.log(`\n[onmaum] npm ${args.join(' ')}`)
      const result = spawnSync(process.execPath, [env.npm_execpath, ...args], {
        cwd: repositoryRoot,
        env,
        stdio: 'inherit',
        windowsHide: true,
      })
      if (result.error) throw result.error
      if (result.signal) {
        console.error(`[onmaum] Command stopped by ${result.signal}.`)
        return 128 + (constants.signals[result.signal] ?? 1)
      }
      if (result.status !== 0) return result.status ?? 1
    }
    return 0
  } catch (error) {
    console.error(`[onmaum] ${error.message}`)
    return 1
  }
}
