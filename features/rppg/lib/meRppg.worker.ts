/// <reference lib="webworker" />
// 상태공간 rPPG 추론 워커. 프레임 1장(36×36 RGB) + 직전 상태 → BVP 1개 + 다음 상태.
// 모델은 워커 이름으로 고른다(`new Worker(url, { name: 'facephys' })`). 이름이 없으면 ME-rPPG.
// ME-rPPG 입출력은 공식 데모 onnxWorker.js와 같다: 입력 [0]=영상, [1..36]=상태, [37]=dt / 출력 [0]=BVP, [1..36]=다음 상태.
// FacePhys 는 입력 [0]=영상, [1]=dt, [2..47]=상태 / 출력 [0]=BVP, [1..46]=다음 상태.

import * as ort from 'onnxruntime-web/wasm'
import {
  STATE_MODELS,
  frameDt,
  parseStateBin,
  stateInputNames,
  type StateModelId,
  type StateSpec,
} from '@/features/rppg/lib/meRppg'

export type MeWorkerIn =
  | { type: 'frame'; input: Float32Array; t: number; epoch: number }
  | { type: 'reset' }
export type MeWorkerOut =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'bvp'; value: number; t: number; latency: number; epoch: number }

ort.env.wasm.wasmPaths = '/vendor/ort/'
ort.env.wasm.numThreads = 1

const MODEL = STATE_MODELS[(self.name in STATE_MODELS ? self.name : 'me') as StateModelId]

let session: ort.InferenceSession | null = null
let initial: { name: string; shape: number[]; data: Float32Array }[] = []
let state: Record<string, ort.Tensor> = {}
let stateNames: string[] = []
let dtName = ''
let lastT: number | null = null
let queue: Promise<void> = Promise.resolve()

const post = (m: MeWorkerOut) => self.postMessage(m)

function resetState() {
  state = Object.fromEntries(initial.map((s) => [s.name, new ort.Tensor('float32', s.data.slice(), s.shape)]))
  lastT = null
}

async function init() {
  const [specs, stateBuf] = await Promise.all([
    fetch(MODEL.base + 'state-shapes.json').then((r) => r.json() as Promise<StateSpec[]>),
    fetch(MODEL.base + 'state.bin').then((r) => r.arrayBuffer()),
  ])
  initial = parseStateBin(specs, stateBuf)
  session = await ort.InferenceSession.create(MODEL.base + 'model.onnx', { executionProviders: ['wasm'] })
  const dtIndex = MODEL.dtIndex(session.inputNames.length)
  dtName = session.inputNames[dtIndex]
  stateNames = stateInputNames(session.inputNames, dtIndex)
  if (
    stateNames.length !== initial.length ||
    session.outputNames.length !== initial.length + 1 ||
    !initial.every((s, i) => s.name === stateNames[i])
  ) {
    throw new Error(`${MODEL.label} 모델 입력과 초기 상태가 맞지 않아요`)
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
  const dt = frameDt(lastT, msg.t, MODEL.maxDt)
  lastT = msg.t
  const feeds: Record<string, ort.Tensor> = {
    ...state,
    [s.inputNames[0]]: new ort.Tensor('float32', msg.input, [1, 1, 36, 36, 3]),
    [dtName]: new ort.Tensor('float32', new Float32Array([dt]), MODEL.dtShape),
  }
  const t0 = performance.now()
  const out = await s.run(feeds)
  const latency = performance.now() - t0
  for (let i = 1; i < s.outputNames.length; i++) state[stateNames[i - 1]] = out[s.outputNames[i]]
  const value = (out[s.outputNames[0]].data as Float32Array)[0]
  // 상태가 한 번 NaN 이 되면 계속 NaN 이다. 초기 상태로 되돌려 다음 프레임부터 다시 시작한다(값은 화면에서 버린다)
  if (!Number.isFinite(value)) resetState()
  post({ type: 'bvp', value, t: msg.t, latency, epoch: msg.epoch })
}

// session.run은 동시에 여러 번 부를 수 없어서 메시지를 순서대로 처리
self.onmessage = (e: MessageEvent<MeWorkerIn>) => {
  queue = queue.then(() => handle(e.data)).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  })
}

init().catch((err: unknown) => {
  post({ type: 'error', message: `${MODEL.label} 초기화 실패: ${err instanceof Error ? err.message : String(err)}` })
})
