/// <reference lib="webworker" />
// ME-rPPG 추론 워커 (spike). 프레임 1장(36×36 RGB) + 직전 상태 → BVP 1개 + 다음 상태.
// 입출력 규약은 공식 데모 onnxWorker.js와 동일: 입력 [0]=영상, [1..36]=상태, [37]=dt / 출력 [0]=BVP, [1..36]=다음 상태.

import * as ort from 'onnxruntime-web/wasm'
import { frameDt, parseStateBin, type StateSpec } from '@/features/rppg/lib/meRppg'

export type MeWorkerIn = { type: 'frame'; input: Float32Array; t: number } | { type: 'reset' }
export type MeWorkerOut =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'bvp'; value: number; t: number; latency: number }

ort.env.wasm.wasmPaths = '/vendor/ort/'
ort.env.wasm.numThreads = 1

const BASE = '/models/me-rppg/'

let session: ort.InferenceSession | null = null
let initial: { name: string; shape: number[]; data: Float32Array }[] = []
let state: Record<string, ort.Tensor> = {}
let lastT: number | null = null
let queue: Promise<void> = Promise.resolve()

const post = (m: MeWorkerOut) => self.postMessage(m)

function resetState() {
  state = Object.fromEntries(initial.map((s) => [s.name, new ort.Tensor('float32', s.data.slice(), s.shape)]))
  lastT = null
}

async function init() {
  const [specs, stateBuf] = await Promise.all([
    fetch(BASE + 'state-shapes.json').then((r) => r.json() as Promise<StateSpec[]>),
    fetch(BASE + 'state.bin').then((r) => r.arrayBuffer()),
  ])
  initial = parseStateBin(specs, stateBuf)
  session = await ort.InferenceSession.create(BASE + 'model.onnx', { executionProviders: ['wasm'] })
  const names = new Set(session.inputNames)
  if (session.inputNames.length !== initial.length + 2 || !initial.every((s) => names.has(s.name))) {
    throw new Error('ME-rPPG 모델 입력과 초기 상태가 맞지 않아요')
  }
  resetState()
  post({ type: 'ready' })
}

async function handle(msg: MeWorkerIn) {
  if (msg.type === 'reset') {
    if (session) resetState()
    return
  }
  if (!session) return
  const s = session
  const dt = frameDt(lastT, msg.t)
  lastT = msg.t
  const feeds: Record<string, ort.Tensor> = {
    ...state,
    [s.inputNames[0]]: new ort.Tensor('float32', msg.input, [1, 1, 36, 36, 3]),
    [s.inputNames[s.inputNames.length - 1]]: new ort.Tensor('float32', new Float32Array([dt]), []),
  }
  const t0 = performance.now()
  const out = await s.run(feeds)
  const latency = performance.now() - t0
  for (let i = 1; i < s.outputNames.length; i++) state[s.inputNames[i]] = out[s.outputNames[i]]
  post({ type: 'bvp', value: (out[s.outputNames[0]].data as Float32Array)[0], t: msg.t, latency })
}

// session.run은 동시에 여러 번 부를 수 없어서 메시지를 순서대로 처리
self.onmessage = (e: MessageEvent<MeWorkerIn>) => {
  queue = queue.then(() => handle(e.data)).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  })
}

init().catch((err: unknown) => {
  post({ type: 'error', message: `ME-rPPG 초기화 실패: ${err instanceof Error ? err.message : String(err)}` })
})
