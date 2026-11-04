import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { summarize } from './metrics.mjs'
import { NEUTRAL_ONLY, validateCalibration } from './calibration.mjs'

const input = process.argv[2]
if (!input) throw new Error('1차 형식의 평가 summary JSON 경로를 지정하세요')
const inference = JSON.parse(await readFile(input, 'utf8'))
const rows = (await readFile(inference.framesPath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line))
const grouped = new Map()
for (const row of rows) {
  if (!grouped.has(row.video)) grouped.set(row.video, { id: row.video, actor: row.actor, source: row.source, intensity: row.intensity, frames: [] })
  grouped.get(row.video).frames.push(row)
}
const videos = [...grouped.values()]
const analysisHashes = {}
for (const name of ['metrics.mjs', 'calibration.mjs', 'round2.mjs']) {
  analysisHashes[name] = createHash('sha256').update(await readFile(new URL(name, import.meta.url))).digest('hex')
}
const result = { input, analysisHashes, cacheStats: inference.cacheStats, inventory: inference.inventory, baseline: summarize(videos), legacy: inference.validation,
  calibration: {}, sensitivity: { baseline: summarize(videos, null, NEUTRAL_ONLY), calibration: {} } }
for (const kind of ['logistic', 'bias']) {
  result.calibration[kind] = validateCalibration(videos, kind)
  result.sensitivity.calibration[kind] = validateCalibration(videos, kind, NEUTRAL_ONLY)
  console.log(`${kind}: 기본 ${(100 * result.calibration[kind].tuned.central.frameAccuracy).toFixed(2)}%, 민감도 ${(100 * result.sensitivity.calibration[kind].tuned.central.frameAccuracy).toFixed(2)}%`)
}
const destination = input.replace(/summary-/, 'round2-')
await writeFile(destination, JSON.stringify(result, null, 2))
console.log(`2차 평가 저장: ${destination}`)
