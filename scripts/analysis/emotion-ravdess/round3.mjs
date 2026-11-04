import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { validateProtected } from './protected-calibration.mjs'

const input = process.argv[2]
if (!input) throw new Error('평가 summary JSON 경로를 지정하세요')
const inference = JSON.parse(await readFile(input, 'utf8'))
const grouped = new Map()
for (const line of (await readFile(inference.framesPath, 'utf8')).trim().split('\n')) {
  const row = JSON.parse(line)
  if (!grouped.has(row.video)) grouped.set(row.video, { id: row.video, actor: row.actor, source: row.source, intensity: row.intensity, frames: [] })
  grouped.get(row.video).frames.push(row)
}
const analysisHashes = {}
for (const name of ['metrics.mjs', 'calibration.mjs', 'protected-calibration.mjs', 'round3.mjs']) {
  analysisHashes[name] = createHash('sha256').update(await readFile(new URL(name, import.meta.url))).digest('hex')
}
const result = { input, analysisHashes, inventory: inference.inventory, cacheStats: inference.cacheStats, baseline: inference.baseline,
  legacy: inference.validation, candidates: validateProtected([...grouped.values()]) }
const destination = input.replace('summary-', 'round3-')
await writeFile(destination, JSON.stringify(result, null, 2))
console.log(`3차 평가 저장: ${destination}`)
