// Electron 패키징용 빌드: 정적 export(out/) + main·preload 컴파일(dist-electron/).
// 오래된 산출물을 묶지 않도록 매번 지우고 새로 만든다.
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { compileElectron, nextBin, root, runNode } from './lib.mjs'
import { flattenSegmentFiles } from './segmentFiles.mjs'

try {
  for (const dir of ['out', 'dist-electron']) {
    rmSync(join(root, dir), { recursive: true, force: true })
  }

  runNode(nextBin, ['build'], { env: { ONMAUM_TARGET: 'electron', NEXT_TELEMETRY_DISABLED: '1' } })
  // Windows 빌드에서 폴더로 저장된 세그먼트 prefetch 파일을 클라이언트가 찾는 이름으로 옮긴다(segmentFiles.mjs 설명)
  const moved = flattenSegmentFiles(join(root, 'out'))
  if (moved > 0) console.log(`[onmaum] 세그먼트 prefetch 파일 ${moved}개 이름 정리`)
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
    // 새 디자인 화면(데스크톱 앱 첫 화면과 측정 흐름)
    'out/demo/hero-stage/index.html',
    'out/demo/measure/index.html',
    'out/demo/result/index.html',
    'out/demo/report/index.html',
    'out/demo/records/index.html',
    'out/demo/survey/index.html',
    // rPPG 모델·WASM 런타임(앱 안에서만 불러온다)
    'out/models/me-rppg/model.onnx',
    'out/models/me-rppg/state.bin',
    'out/models/me-rppg/state-shapes.json',
    'out/models/blazeface/blaze_face_short_range.tflite',
    'out/vendor/ort/ort-wasm-simd-threaded.mjs',
    'out/vendor/ort/ort-wasm-simd-threaded.wasm',
    'out/vendor/mediapipe/vision_wasm_internal.js',
    'out/vendor/mediapipe/vision_wasm_internal.wasm',
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
