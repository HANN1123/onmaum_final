// rPPG 실험실용 WASM 런타임을 node_modules → public/vendor 로 복사한다 (git 미추적, postinstall 실행).
// 외부 CDN 없이 자체 서빙해 영상·데이터가 기기 밖으로 나가지 않게 한다.
// 파일이 빠진 채 설치가 성공하면 실험실이 실행 중에야 깨지므로, 누락은 설치 실패로 알린다.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const copies = [
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'public/vendor/ort'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'public/vendor/ort'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js', 'public/vendor/mediapipe'],
  ['node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm', 'public/vendor/mediapipe'],
]

const missing = copies.map(([src]) => src).filter((src) => !existsSync(join(root, src)))
if (missing.length > 0) {
  console.error(`rPPG WASM 원본이 없습니다. 패키지 버전과 복사 목록을 확인하세요:\n${missing.join('\n')}`)
  process.exit(1)
}

try {
  for (const [src, dir] of copies) {
    mkdirSync(join(root, dir), { recursive: true })
    copyFileSync(join(root, src), join(root, dir, basename(src)))
  }
} catch (err) {
  console.error(`rPPG WASM 복사 실패: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}

console.log(`rPPG WASM 자산 ${copies.length}개 복사 → public/vendor/`)
