import { describe, expect, it } from 'vitest'
import { createMotionSmoother, MOTION_TAU_MS } from '@/features/rppg/lib/motionSmoothing'
import { createKalman1D, expandFaceBox, clampCrop, type FaceBox } from '@/features/rppg/lib/meRppg'
import { createHrTracker, MOTION_LIMIT, MOTION_MASK_RATIO, type BoxSample, type BvpPoint } from '@/features/rppg/lib/hrEstimator'
import { gateReading } from '@/features/rppg/engine/rppgGate'

const FRAME_RATES = [10, 15, 24, 30]

/** 검출 → crop 칼만과 별도 움직임 평활 → 실제 추정기 → 실제 표시 게이트를 연결한다. */
function simulate(fps: number, moving: boolean) {
  const smoother = createMotionSmoother()
  const kalman = [270, 204, 100, 100].map((v) => createKalman1D(1e-2, 0.5, v, 1))
  const boxes: BoxSample[] = []
  const oldBoxes: BoxSample[] = []
  const bvp: BvpPoint[] = []
  let seed = 12345
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000 - 0.5
  }
  for (let i = 0; i <= 30 * fps; i++) {
    const t = i * 1000 / fps
    const nod = Math.sin(2 * Math.PI * 1.1 * t / 1000)
    const raw: FaceBox = moving
      ? { originX: 270, originY: 204 + 4 * nod, width: 100, height: 100 }
      : { originX: 270 + noise(), originY: 204 + noise(), width: 100 + noise(), height: 100 + noise() }
    const cropBox = expandFaceBox({
      originX: kalman[0].update(raw.originX), originY: kalman[1].update(raw.originY),
      width: kalman[2].update(raw.width), height: kalman[3].update(raw.height),
    })
    expect(clampCrop(cropBox, 640, 480)).not.toBeNull()
    oldBoxes.push({ t, cx: cropBox.originX + cropBox.width / 2, cy: cropBox.originY + cropBox.height / 2, w: cropBox.width })
    boxes.push(smoother.update(raw, t))
    // 움직임이 있으면 모델이 끄덕임 주기를 내는 리뷰 재현 조건(66 BPM)을 사용한다.
    bvp.push({ t, v: moving ? nod : Math.sin(2 * Math.PI * 1.4 * t / 1000) })
  }
  const estimate = createHrTracker().estimate([bvp], boxes)!
  const oldEstimate = createHrTracker().estimate([bvp], oldBoxes)!
  expect(estimate).not.toBeNull()
  const gate = gateReading({
    engine: 'ready', face: true, outputs: bvp.length, lastFrameT: 30_000, now: 30_000,
    estimate, firstEstimateAt: 6_000, minSnrDb: 0, motion: estimate.motion,
  })
  return { fps, motion: estimate.motion!, oldMotion: oldEstimate.motion!, gate }
}

describe('시간 기반 움직임 좌표와 추정·표시 게이트', () => {
  it('같은 1.1Hz·4px/100px 흔들림은 모든 FPS에서 ±15% 이내이고 2% 게이트로 차단된다', () => {
    const results = FRAME_RATES.map((fps) => simulate(fps, true))
    const min = Math.min(...results.map((r) => r.motion))
    const max = Math.max(...results.map((r) => r.motion))
    expect(max / min).toBeLessThanOrEqual(1.15)
    for (const r of results) {
      expect(r.motion).toBeGreaterThan(MOTION_MASK_RATIO)
      expect(r.motion).toBeGreaterThan(MOTION_LIMIT)
      expect(r.gate.status).toBe('motion')
      expect(r.gate.bpm).toBeNull()
    }
    // 30fps의 기존 보정은 유지한다. 정상상태 창에서 기존 칼만 대비 1% 이내다.
    const at30 = results.find((r) => r.fps === 30)!
    expect(Math.abs(at30.motion / at30.oldMotion - 1)).toBeLessThan(0.01)
    console.table(results.map((r) => ({ FPS: r.fps, '새 움직임(%)': r.motion * 100, '기존 칼만(%)': r.oldMotion * 100, '게이트': r.gate.status })))
  })

  it('정지 얼굴의 검출 잡음 ±0.5px은 모든 FPS에서 마스크·게이트 아래로 남는다', () => {
    const results = FRAME_RATES.map((fps) => simulate(fps, false))
    for (const r of results) {
      expect(r.motion).toBeLessThan(MOTION_MASK_RATIO)
      expect(r.motion).toBeLessThan(MOTION_LIMIT)
      expect(r.gate.status).toBe('live')
      expect(r.gate.bpm).toBeCloseTo(84, 0)
    }
    console.table(results.map((r) => ({ FPS: r.fps, '정지 잡음(%)': r.motion * 100, '게이트': r.gate.status })))
  })

  it('동일한 실제 경과 시간의 계단 응답은 프레임 간격과 무관하다', () => {
    expect(MOTION_TAU_MS).toBeCloseTo(235.898, 3)
    const responses = FRAME_RATES.map((fps) => {
      const smoother = createMotionSmoother()
      smoother.update({ originX: 0, originY: 0, width: 100, height: 100 }, 0)
      let last: BoxSample | null = null
      for (let i = 1; i <= fps; i++) last = smoother.update({ originX: 10, originY: 0, width: 100, height: 100 }, i * 1000 / fps)
      return last!.cx
    })
    for (const value of responses) expect(value).toBeCloseTo(responses[0], 10)
  })

  it('초기화하면 이전 위치와 시간의 영향이 사라진다', () => {
    const smoother = createMotionSmoother()
    smoother.update({ originX: 0, originY: 0, width: 100, height: 100 }, 1000)
    smoother.reset()
    expect(smoother.update({ originX: 200, originY: 100, width: 100, height: 100 }, 2000))
      .toEqual({ t: 2000, cx: 250, cy: 136, w: 100 })
  })
})
