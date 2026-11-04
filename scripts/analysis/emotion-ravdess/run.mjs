import { build } from 'vite'
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat, writeFile, appendFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { summarize, crossValidate } from './metrics.mjs'

const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)))
if (path.resolve(process.cwd()) !== root) throw new Error('평가 도구는 현재 작업 공간 루트에서 실행해야 합니다')
const output = path.join(root, '.eval')
await mkdir(output, { recursive: true })
const dataRoot = process.argv[2]
const smoke = process.argv.includes('--smoke')
const native = process.argv.includes('--probe-native')
const probe = process.argv.includes('--probe-webgl') || native
const fresh = process.argv.includes('--fresh')
// 합성 영상의 인코더는 GPU 없는 실행에서도 확인할 수 있게 CPU 진단 경로를 쓴다.
const cpu = smoke || process.argv.includes('--cpu')
const cacheDirectory = cpu ? 'records-cpu' : 'records-native'
const collect = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(async (entry) => entry.isDirectory()
    ? collect(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat()
}
// 동일 영상의 01/02 중 02를 우선하며 음성·노래 중 음성(두 번째 필드 01)만 쓴다.
const unique = new Map()
if (dataRoot && !smoke) {
  for (const file of (await collect(dataRoot)).sort()) {
    const match = path.basename(file).match(/^(0[12])-01-(0[1-8])-(0[12])-(0[12])-(0[12])-(\d{2})\.mp4$/i)
    if (!match || Number(match[6]) < 1 || Number(match[6]) > 8 || !(await stat(file)).size) continue
    const key = path.basename(file).slice(3)
    unique.set(key, { file, id: path.basename(file), source: Number(match[2]), intensity: Number(match[3]), actor: match[6] })
  }
}
const videos = probe ? [...unique.values()].slice(0, 1) : [...unique.values()]
const inventory = { at: new Date().toISOString(), dataRoot, videos }
if (!smoke && !probe) await writeFile(path.join(output, 'inventory.json'), JSON.stringify(inventory, null, 2))
if (!smoke && videos.length === 0) throw new Error('평가할 MP4가 없습니다. .eval/inventory.json을 확인하고 다운로드 완료 후 다시 실행하세요')
await build({ configFile: false, root, publicDir: false, resolve: { alias: { '@': root } },
  build: { outDir: '.eval/web', emptyOutDir: false, minify: false,
    lib: { entry: path.join(root, 'scripts/analysis/emotion-ravdess/browser.js'), formats: ['iife'], name: 'EmotionEval', fileName: () => 'browser.js' } } })
const hashes = {}
for (const name of ['features/rppg/engine/blazeFace.ts', 'features/camera/lib/expressionsFromBox.ts',
  'features/algorithm/emotion/emotionAnalysis.ts', 'features/algorithm/emotion/emotionSmoothing.ts',
  'features/ui/measure/demo/useFaceTrack.ts', 'public/models/blazeface/blaze_face_short_range.tflite',
  'public/models/face_expression_model-shard1', 'public/models/face_landmark_68_model-shard1']) {
  hashes[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex')
}
await writeFile(path.join(output, 'provenance.json'), JSON.stringify({ hashes, node: process.version, intervalMs: 250 }, null, 2))
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<script src="/browser.js"></script>'); return }
    let file
    if (url.pathname === '/browser.js') file = path.join(output, 'web/browser.js')
    else if (url.pathname.startsWith('/video/')) file = videos[Number(url.pathname.slice(7))]?.file
    else if (/^\/(models|vendor)\//.test(url.pathname)) {
      const candidate = path.resolve(root, 'public', `.${decodeURIComponent(url.pathname)}`)
      if (candidate.startsWith(path.join(root, 'public') + path.sep)) file = candidate
    }
    if (!file) { res.writeHead(404).end(); return }
    const { size } = await stat(file)
    const mime = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.json': 'application/json' }
    res.setHeader('Content-Type', mime[path.extname(file)] ? `${mime[path.extname(file)]}${path.extname(file) === '.js' ? '; charset=utf-8' : ''}` : 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start > end || start >= size) { res.writeHead(416).end(); return }
    if (range) res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 })
    else res.setHeader('Content-Length', size)
    createReadStream(file, { start, end }).pipe(res)
  } catch { res.writeHead(404).end() }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(output, `chrome-profile-${process.pid}`)}`,
  '--no-sandbox', ...(native ? [] : probe ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : cpu ? ['--disable-gpu'] : []),
  '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
let socket
let closeBrowser
let failPending = () => {}
try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = ''
    const timer = setTimeout(() => reject(new Error('Chrome CDP 시작 시간 초과')), 30000)
    chrome.on('error', reject)
    chrome.stderr.on('data', (data) => {
      log += data
      const match = log.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
  })
  console.log(`Chrome CDP 연결: ${endpoint}`)
  socket = new WebSocket(endpoint)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome WebSocket 연결 시간 초과')), 10000)
    socket.onopen = () => { clearTimeout(timer); resolve() }
    socket.onerror = (error) => { clearTimeout(timer); reject(error) }
  })
  let nextId = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id) }
    else if (message.method === 'Runtime.consoleAPICalled') console.log('브라우저:', message.params.args.map((a) => a.value ?? a.description).join(' '))
    else if (message.method === 'Runtime.exceptionThrown') console.error('브라우저 오류:', JSON.stringify(message.params))
  }
  failPending = () => {
    for (const callback of pending.values()) callback({ error: { message: 'Chrome 연결 종료' } })
    pending.clear()
  }
  socket.onclose = failPending
  const cdp = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP 시간 초과: ${method}`)) }, 120000)
    pending.set(id, (message) => {
      clearTimeout(timer)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
  closeBrowser = () => cdp('Browser.close')
  const chromeVersion = await cdp('Browser.getVersion')
  const { targetId } = await cdp('Target.createTarget', { url: `http://127.0.0.1:${server.address().port}` })
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true })
  console.log('브라우저 평가 페이지 연결 완료')
  await cdp('Runtime.enable', {}, sessionId)
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  for (let i = 0; i < 100 && !(await evaluate('typeof window.evaluateVideo === "function"')); i++) await new Promise((r) => setTimeout(r, 100))
  if (!(await evaluate('typeof window.evaluateVideo === "function"'))) throw new Error('브라우저 번들 초기화 실패')
  console.log('브라우저 번들 준비 완료')
  if (probe) {
    const started = Date.now()
    const result = await evaluate("window.evaluateVideo('/video/0')")
    await writeFile(path.join(output, native ? 'probe-native.json' : 'probe-webgl.json'), JSON.stringify({ video: videos[0].id, elapsedMs: Date.now() - started, result }, null, 2))
    console.log(`WebGL 확인: ${result.frames.length}프레임, ${Date.now() - started}ms`)
  } else if (smoke) {
    // 합성 단색 영상으로 디코딩·WASM·모델 로드·무검출 처리를 확인한다. 정확도 평가에는 쓰지 않는다.
    const result = await evaluate(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      canvas.getContext('2d').fillRect(0, 0, 320, 240);
      document.body.append(canvas);
      const stream = canvas.captureStream(10); const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }); const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      let tick = 0;
      const draw = setInterval(() => { canvas.getContext('2d').fillStyle = (++tick % 2) ? '#111' : '#222'; canvas.getContext('2d').fillRect(0, 0, 320, 240) }, 100);
      await new Promise(resolve => { recorder.onstop = resolve; recorder.start(); setTimeout(() => recorder.stop(), 1000) });
      clearInterval(draw);
      stream.getTracks().forEach(t => t.stop());
      canvas.remove();
      const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
      try { return await window.evaluateVideo(url) } finally { URL.revokeObjectURL(url) }
    })()`)
    await writeFile(path.join(output, 'smoke.json'), JSON.stringify(result, null, 2))
    if (result.frames.length < 3 || result.frames.some((f) => f.raw)) throw new Error('무검출 합성 영상 검증 실패')
    console.log(`합성 영상 검증 통과: ${result.frames.length}프레임, 얼굴 없음`)
  } else {
    const records = []
    const cacheStats = { reused: 0, inferred: 0 }
    await mkdir(path.join(output, cacheDirectory), { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const framesPath = path.join(output, `frames-${stamp}.jsonl`)
    for (const [index, video] of videos.entries()) {
      const cachePath = path.join(output, cacheDirectory, `${video.id}.json`)
      const fingerprint = JSON.stringify({ hashes, size: (await stat(video.file)).size })
      let result
      try {
        const cached = JSON.parse(await readFile(cachePath, 'utf8'))
        if (!fresh && cached.fingerprint === fingerprint) result = cached.result
      } catch { /* 캐시가 없으면 원본 영상을 추론한다. */ }
      if (!result) {
        cacheStats.inferred++
        result = await evaluate(`window.evaluateVideo('/video/${index}')`)
        await writeFile(cachePath, JSON.stringify({ fingerprint, result }))
      } else cacheStats.reused++
      const record = { ...video, ...result }
      records.push(record)
      await appendFile(framesPath, result.frames.map((frame) => JSON.stringify({ video: video.id, actor: video.actor, source: video.source, intensity: video.intensity, ...frame })).join('\n') + '\n')
      console.log(`${index + 1}/${videos.length}: ${video.id}, ${result.frames.length}프레임`)
    }
    const report = { framesPath, inventory, chromeVersion, cacheStats, baseline: summarize(records), validation: crossValidate(records) }
    await writeFile(path.join(output, `summary-${stamp}.json`), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  }
} finally {
  if (closeBrowser) await Promise.race([closeBrowser().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 2000))])
  failPending()
  socket?.close()
  chrome.stderr.destroy()
  chrome.kill()
  chrome.unref()
  server.closeAllConnections()
  server.close()
}
