// Electron 개발 실행: 고정 포트 3003의 next dev가 준비되면 Electron을 띄운다.
// 3003이 이미 쓰이고 있으면 다른 포트로 옮기지 않고 실패한다. 끝나면 자기가 띄운 프로세스를 정리한다.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import net from 'node:net'
import { join } from 'node:path'
import { compileElectron, killTree, nextBin, root, startNode } from './lib.mjs'

const PORT = 3003
const URL_ = `http://localhost:${PORT}/`
const READY_TIMEOUT_MS = 180_000

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: 'localhost' })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

async function waitForServer(child) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('next dev가 준비 전에 종료됐습니다')
    try {
      const res = await fetch(URL_)
      if (res.ok) return
    } catch {
      // 아직 준비 안 됨
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`next dev가 ${READY_TIMEOUT_MS / 1000}초 안에 준비되지 않았습니다`)
}

let next = null
let electron = null
let cleaned = false

function cleanup() {
  if (cleaned) return
  cleaned = true
  killTree(electron)
  killTree(next)
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(143)
})
process.on('exit', cleanup)

try {
  if (await portInUse(PORT)) {
    throw new Error(`포트 ${PORT}이 이미 사용 중입니다. 그 프로세스를 끈 뒤 다시 실행하세요.`)
  }

  compileElectron()

  next = startNode(nextBin, ['dev', '--port', String(PORT)], { env: { NEXT_TELEMETRY_DISABLED: '1' } })
  await waitForServer(next)

  // electron 패키지는 실행 파일 경로를 돌려준다(바이너리가 없으면 이때 내려받는다).
  const require = createRequire(join(root, 'package.json'))
  const electronPath = require('electron')
  electron = spawn(electronPath, ['.'], { cwd: root, stdio: 'inherit', env: { ...process.env } })

  const code = await new Promise((resolve) => {
    electron.once('exit', (c) => resolve(c ?? 0))
    next.once('exit', () => resolve(1))
  })
  cleanup()
  process.exitCode = code
} catch (err) {
  console.error(`\n[onmaum] ${err instanceof Error ? err.message : err}`)
  cleanup()
  process.exitCode = 1
}
