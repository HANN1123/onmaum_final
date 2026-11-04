import { describe, it, expect } from 'vitest'
import {
  createKalman1D,
  expandFaceBox,
  clampCrop,
  rgbaToModelInput,
  frameDt,
  parseStateBin,
} from '@/features/rppg/lib/meRppg'

describe('createKalman1D', () => {
  it('첫 갱신은 예측오차/(예측오차+측정잡음) 비율만큼 측정값 쪽으로 움직인다', () => {
    // 초기 0, 초기오차 1, 과정잡음 0.01, 측정잡음 0.5 → 이득 1.01/1.51
    const kf = createKalman1D(0.01, 0.5, 0, 1)
    expect(kf.update(10)).toBeCloseTo(6.6887, 4)
  })

  it('같은 값을 계속 넣으면 그 값으로 수렴한다', () => {
    const kf = createKalman1D(0.01, 0.5, 0, 1)
    let v = 0
    for (let i = 0; i < 200; i++) v = kf.update(10)
    expect(v).toBeCloseTo(10, 3)
  })
})

describe('expandFaceBox', () => {
  it('높이를 1.2배로 늘리고 늘어난 높이의 20%만큼 위로 올린다 (이마 포함, ME-rPPG 데모 규약)', () => {
    expect(expandFaceBox({ originX: 100, originY: 200, width: 50, height: 100 })).toEqual({
      originX: 100,
      originY: 176,
      width: 50,
      height: 120,
    })
  })
})

describe('clampCrop', () => {
  it('프레임 밖으로 나간 박스를 프레임 안으로 자른다', () => {
    expect(clampCrop({ originX: -10, originY: 450, width: 100, height: 100 }, 640, 480)).toEqual({
      sx: 0,
      sy: 450,
      sw: 100,
      sh: 30,
    })
  })

  it('박스가 프레임 밖에 완전히 있으면 null', () => {
    expect(clampCrop({ originX: 700, originY: 10, width: 50, height: 50 }, 640, 480)).toBeNull()
  })
})

describe('rgbaToModelInput', () => {
  it('RGBA 바이트를 알파 없이 RGB 0~1 실수로 바꾼다', () => {
    const out = rgbaToModelInput(new Uint8ClampedArray([255, 0, 51, 255, 0, 255, 102, 128]))
    expect(out).toEqual(new Float32Array([1, 0, 0.2, 0, 1, 0.4]))
  })
})

describe('frameDt', () => {
  it('첫 프레임은 1/30초', () => {
    expect(frameDt(null, 1000)).toBeCloseTo(1 / 30)
  })
  it('프레임 간격(초)을 그대로 준다', () => {
    expect(frameDt(1000, 1050)).toBeCloseTo(0.05)
  })
  it('1/90초보다 짧으면 1/90초로 올린다', () => {
    expect(frameDt(1000, 1005)).toBeCloseTo(1 / 90)
  })
})

describe('parseStateBin', () => {
  it('이어붙인 float32 바이너리를 이름·모양별 텐서 데이터로 나눈다', () => {
    const buf = new Float32Array([1, 2, 3, 4, 5, 6, 7]).buffer
    const parts = parseStateBin(
      [
        { name: 'a', shape: [2, 2] },
        { name: 'b', shape: [3] },
      ],
      buf,
    )
    expect(parts.map((p) => [p.name, p.shape, Array.from(p.data)])).toEqual([
      ['a', [2, 2], [1, 2, 3, 4]],
      ['b', [3], [5, 6, 7]],
    ])
  })

  it('모양 합계와 바이너리 크기가 다르면 오류 (손상·버전 불일치 조기 발견)', () => {
    expect(() => parseStateBin([{ name: 'a', shape: [4] }], new Float32Array(3).buffer)).toThrow()
  })
})
