import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { test } from 'node:test'

function fixture(t) {
  const tempRoot = resolve(tmpdir())
  const root = mkdtempSync(join(tempRoot, 'onmaum-tooling-'))
  t.after(() => {
    const target = resolve(root)
    const withinTemp = relative(tempRoot, target)
    assert.ok(!isAbsolute(withinTemp) && withinTemp.startsWith('onmaum-tooling-') && !withinTemp.includes('..'))
    rmSync(target, { recursive: true, force: true })
  })
  const scripts = join(root, 'scripts', 'collaboration')
  mkdirSync(scripts, { recursive: true })
  for (const name of ['runner.mjs', 'check.mjs', 'setup.mjs']) {
    copyFileSync(new URL(`../../scripts/collaboration/${name}`, import.meta.url), join(scripts, name))
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'onmaum', private: true }))
  const log = join(root, 'calls.jsonl')
  const npm = join(root, 'mock npm.mjs')
  writeFileSync(npm, `
    import { appendFileSync } from 'node:fs'
    const args = process.argv.slice(2)
    appendFileSync(process.env.MOCK_NPM_LOG, JSON.stringify({
      args, cwd: process.cwd(), workers: process.env.VITEST_MAX_WORKERS,
    }) + '\\n')
    if (args[1] === process.env.MOCK_NPM_FAIL) process.exit(7)
  `)
  const env = { ...process.env, npm_execpath: npm, MOCK_NPM_LOG: log }
  delete env.VITEST_MAX_WORKERS
  delete env.MOCK_NPM_FAIL
  return {
    root,
    env,
    calls: () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [],
    run: (name, options = {}) => spawnSync(process.execPath, [join(scripts, `${name}.mjs`)], {
      cwd: root, env, encoding: 'utf8', ...options,
    }),
  }
}

test('check runs tooling tests, application tests, lint and build in order with two workers by default', (t) => {
  const f = fixture(t)
  const result = f.run('check')
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(f.calls().map(({ args }) => args), [
    ['run', 'test:tooling'], ['run', 'test:run'], ['run', 'lint'], ['run', 'build'],
  ])
  assert.ok(f.calls().every(({ cwd, workers }) => cwd === f.root && workers === '2'))
})

test('check preserves the worker override and stops at the failing command with its exit code', (t) => {
  const f = fixture(t)
  f.env.VITEST_MAX_WORKERS = '3'
  f.env.MOCK_NPM_FAIL = 'lint'
  const result = f.run('check')
  assert.equal(result.status, 7)
  assert.deepEqual(f.calls().map(({ args }) => args[1]), ['test:tooling', 'test:run', 'lint'])
  assert.ok(f.calls().every(({ workers }) => workers === '3'))
})

test('check rejects invalid worker values before invoking npm', (t) => {
  const f = fixture(t)
  for (const invalid of ['0', '-1', '50%', 'two', '1.5', '']) {
    const result = f.run('check', { env: { ...f.env, VITEST_MAX_WORKERS: invalid } })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /VITEST_MAX_WORKERS must be a positive integer/)
  }
  assert.deepEqual(f.calls(), [])
})

test('setup invokes a locked install only in this worktree', (t) => {
  const f = fixture(t)
  const result = f.run('setup')
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(f.calls(), [{ args: ['ci', '--no-audit', '--no-fund'], cwd: f.root }])
})

test('direct invocation explains the npm requirement without running a child', (t) => {
  const f = fixture(t)
  delete f.env.npm_execpath
  const result = f.run('setup')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /npm_execpath is missing/)
  assert.deepEqual(f.calls(), [])
})

test('setup refuses another working directory or package before invoking npm', (t) => {
  const f = fixture(t)
  const nested = join(f.root, 'nested')
  mkdirSync(nested)
  const wrongDirectory = f.run('setup', { cwd: nested })
  assert.equal(wrongDirectory.status, 1)
  assert.match(wrongDirectory.stderr, /root of this onmaum worktree/)
  writeFileSync(join(f.root, 'package.json'), JSON.stringify({ name: 'another-project' }))
  const wrongPackage = f.run('setup')
  assert.equal(wrongPackage.status, 1)
  assert.match(wrongPackage.stderr, /Expected the onmaum package/)
  assert.deepEqual(f.calls(), [])
})

test('setup refuses shared node_modules before npm can modify the target', (t) => {
  const f = fixture(t)
  const shared = join(f.root, 'another-worktree-node-modules')
  mkdirSync(shared)
  const marker = join(shared, 'keep.txt')
  writeFileSync(marker, 'unchanged')
  symlinkSync(shared, join(f.root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const result = f.run('setup')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /shared symlinks or junctions are not supported/)
  assert.equal(readFileSync(marker, 'utf8'), 'unchanged')
  assert.deepEqual(f.calls(), [])
})
