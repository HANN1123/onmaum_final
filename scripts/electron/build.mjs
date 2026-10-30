// Electron 패키징용 빌드: 정적 export(out/) + main·preload 컴파일(dist-electron/).
// 오래된 산출물을 묶지 않도록 매번 지우고 새로 만든다.
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { compileElectron, nextBin, root, runNode } from './lib.mjs'

try {
  for (const dir of ['out', 'dist-electron']) {
    rmSync(join(root, dir), { recursive: true, force: true })
  }

  runNode(nextBin, ['build'], { env: { ONMAUM_TARGET: 'electron', NEXT_TELEMETRY_DISABLED: '1' } })
  compileElectron()

  const required = [
    'out/index.html',
    'out/404.html',
    'out/measure/index.html',
    'out/stats/index.html',
    'out/records/index.html',
    'out/demo/index.html',
    'out/orb-preview/index.html',
    'out/widget/index.html',
    'out/models/tiny_face_detector_model-weights_manifest.json',
    'dist-electron/main/index.js',
    'dist-electron/preload/index.js',
  ]
  const missing = required.filter((p) => !existsSync(join(root, p)))
  if (missing.length > 0) throw new Error(`산출물 누락: ${missing.join(', ')}`)

  // 샌드박스 preload는 electron 외의 모듈을 require할 수 없다.
  const preload = readFileSync(join(root, 'dist-electron/preload/index.js'), 'utf8')
  const requires = [...preload.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1])
  if (requires.some((r) => r !== 'electron') || /^\s*import\s/m.test(preload)) {
    throw new Error(`preload에 허용되지 않은 import가 있습니다: ${requires.join(', ')}`)
  }

  console.log('\n[onmaum] Electron 빌드 완료: out/, dist-electron/')
} catch (err) {
  console.error(`\n[onmaum] ${err instanceof Error ? err.message : err}`)
  process.exitCode = 1
}
