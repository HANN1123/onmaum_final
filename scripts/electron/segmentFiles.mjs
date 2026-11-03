// Next.js 16 정적 export 의 화면 이동 데이터(세그먼트 prefetch) 파일 이름을 바로잡는다.
//
// 클라이언트는 `/<경로>/__next.<세그먼트들을 .으로 이은 것>.txt` 를 요청한다(예: __next.demo.hero-stage.__PAGE__.txt).
// 그런데 Windows 에서 export 하면 세그먼트 경로의 구분자가 `\` 라서 `.` 으로 바뀌지 않고,
// `__next.demo/hero-stage/__PAGE__.txt` 처럼 폴더로 저장된다(next/dist/export/index.js 의 convertSegmentPathToStaticExportFilename 이
// `/` 만 바꾼다). 그 결과 앱에서 링크를 미리 불러올 때 404 가 난다. Linux 에서 빌드하면 생기지 않는다.
// 이 함수는 out/ 아래의 `__next.*` 폴더 안 파일을 클라이언트가 찾는 이름으로 옮기고 빈 폴더를 지운다.
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** 폴더 안 모든 파일의 상대 경로(구분자 /) */
function listFiles(dir, prefix = '') {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(full).isDirectory()) out.push(...listFiles(full, rel))
    else out.push(rel)
  }
  return out
}

/** out 폴더를 고친다. 옮긴 파일 수를 돌려준다 */
export function flattenSegmentFiles(outDir) {
  let moved = 0
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (!statSync(full).isDirectory()) continue
      if (name.startsWith('__next.')) {
        for (const rel of listFiles(full)) {
          // __next.demo + hero-stage/__PAGE__.txt → __next.demo.hero-stage.__PAGE__.txt
          renameSync(join(full, ...rel.split('/')), join(dir, `${name}.${rel.split('/').join('.')}`))
          moved++
        }
        rmSync(full, { recursive: true, force: true })
      } else {
        walk(full)
      }
    }
  }
  walk(outDir)
  return moved
}
