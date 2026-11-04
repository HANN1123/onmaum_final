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

/** 모델 상태 갱신에 쓰는 프레임 간격(초). 첫 프레임 1/30, 하한 1/90 (데모와 동일) */
export function frameDt(prevMs: number | null, tMs: number): number {
  if (prevMs === null) return 1 / 30
  return Math.max((tMs - prevMs) / 1000, 1 / 90)
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
