// ME-rPPG(Wang et al. 2025, arXiv 2504.01774) 브라우저 추론용 순수 함수.
// 전처리는 공식 데모(Health-HCI-Group/ME-rPPG-demo, Apache-2.0)와 동일하게 맞춘다 —
// 얼굴 박스 칼만 스무딩 → 높이 1.2배·위로 20% → 36×36 → RGB/255, 프레임 간격 dt 함께 입력.

export interface FaceBox {
  originX: number
  originY: number
  width: number
  height: number
}

export interface Kalman1D {
  update(measurement: number): number
}

export function createKalman1D(
  processNoise: number,
  measurementNoise: number,
  initial: number,
  initialError: number,
): Kalman1D {
  let estimate = initial
  let error = initialError
  return {
    update(measurement) {
      const predictionError = error + processNoise
      const gain = predictionError / (predictionError + measurementNoise)
      estimate += gain * (measurement - estimate)
      error = (1 - gain) * predictionError
      return estimate
    },
  }
}

/** 데모 규약: 높이 ×1.2 후, 늘어난 높이의 20%만큼 위로 — 이마까지 포함 */
export function expandFaceBox(box: FaceBox): FaceBox {
  const height = box.height * 1.2
  return { originX: box.originX, originY: box.originY - height * 0.2, width: box.width, height }
}

/** 데모 규약: 시작점만 프레임 안으로 당기고 크기는 유지(오른쪽·아래 끝에서만 자름) */
export function clampCrop(
  box: FaceBox,
  frameW: number,
  frameH: number,
): { sx: number; sy: number; sw: number; sh: number } | null {
  const sx = Math.max(0, box.originX)
  const sy = Math.max(0, box.originY)
  const sw = Math.min(box.width, frameW - sx)
  const sh = Math.min(box.height, frameH - sy)
  if (sw <= 0 || sh <= 0) return null
  return { sx, sy, sw, sh }
}

export function rgbaToModelInput(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array((rgba.length / 4) * 3)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i] / 255
    out[j + 1] = rgba[i + 1] / 255
    out[j + 2] = rgba[i + 2] / 255
  }
  return out
}

/**
 * 모델 상태 갱신에 쓰는 프레임 간격(초). 첫 프레임 1/30, 하한 1/90 (데모와 동일).
 * maxDt 를 주면 그 이상은 잘라 넣는다(FacePhys 는 0.3초 이상에서 상태가 NaN 으로 무너진다).
 */
export function frameDt(prevMs: number | null, tMs: number, maxDt: number = Infinity): number {
  if (prevMs === null) return 1 / 30
  return Math.min(Math.max((tMs - prevMs) / 1000, 1 / 90), maxDt)
}

/**
 * 같은 36×36 프레임 + dt + 상태 규약을 쓰는 상태공간 rPPG 모델.
 * 입력 순서만 다르다. ME-rPPG 는 [영상, 상태…, dt], FacePhys 는 [영상, dt, 상태…].
 * 둘 다 출력 [0]=BVP, [i]=상태 입력(영상·dt 를 뺀 순서)의 i-1번째 다음 값이다.
 */
export type StateModelId = 'me' | 'facephys'

export interface StateModelSpec {
  id: StateModelId
  label: string
  base: string
  /** inputNames 에서 dt 의 위치 */
  dtIndex: (inputCount: number) => number
  dtShape: number[]
  /** dt 상한(초). 없으면 자르지 않는다 */
  maxDt?: number
}

/**
 * FacePhys dt 상한. 오프라인 재현에서 dt ≥ 0.3초를 한 번만 넣어도 이후 출력이 모두 NaN 이 됐다(0.25초는 정상).
 * 공식 웹 데모는 프레임 간격을 평활해 넣어서 큰 dt 가 들어가지 않는다. 여유를 두고 0.2초로 자른다
 */
export const FACEPHYS_MAX_DT = 0.2

export const STATE_MODELS: Record<StateModelId, StateModelSpec> = {
  me: { id: 'me', label: 'ME-rPPG', base: '/models/me-rppg/', dtIndex: (n) => n - 1, dtShape: [] },
  facephys: {
    id: 'facephys',
    label: 'FacePhys',
    base: '/models/facephys/',
    dtIndex: () => 1,
    dtShape: [1],
    maxDt: FACEPHYS_MAX_DT,
  },
}

/** 영상(0번)과 dt 를 뺀 상태 입력 이름. 출력 i(≥1)는 이 배열의 i-1번째 상태가 된다 */
export function stateInputNames(inputNames: readonly string[], dtIndex: number): string[] {
  return inputNames.filter((_, i) => i !== 0 && i !== dtIndex)
}

export interface StateSpec {
  name: string
  shape: number[]
}

/** state.bin(이어붙인 float32) + state-shapes.json → 초기 상태 텐서 데이터 */
export function parseStateBin(
  specs: StateSpec[],
  buf: ArrayBuffer,
): { name: string; shape: number[]; data: Float32Array }[] {
  const all = new Float32Array(buf)
  const total = specs.reduce((s, sp) => s + sp.shape.reduce((a, b) => a * b, 1), 0)
  if (total !== all.length) {
    throw new Error(`ME-rPPG 상태 크기 불일치: 모양 합계 ${total}, 파일 ${all.length}`)
  }
  let offset = 0
  return specs.map((sp) => {
    const size = sp.shape.reduce((a, b) => a * b, 1)
    const data = all.slice(offset, offset + size)
    offset += size
    return { name: sp.name, shape: sp.shape, data }
  })
}
