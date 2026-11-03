import { describe, it, expect } from 'vitest'
import { coverLayout, mirrorBox, rotatedSize, rotatedVideoStyle } from '@/features/ui/measure/demo/rotationLayout'

describe('카메라 회전 좌표 규칙', () => {
  it('90°·270°이면 가로·세로가 바뀐다', () => {
    expect(rotatedSize(1280, 720, 0)).toEqual({ w: 1280, h: 720 })
    expect(rotatedSize(1280, 720, 90)).toEqual({ w: 720, h: 1280 })
    expect(rotatedSize(1280, 720, 180)).toEqual({ w: 1280, h: 720 })
    expect(rotatedSize(1280, 720, 270)).toEqual({ w: 720, h: 1280 })
  })

  it('돌린 크기로 칸을 꽉 채우고 가운데에 둔다', () => {
    // 가로 칸 800×450에 세운 영상(720×1280): 폭에 맞춰 s = 800/720, 높이는 넘쳐 위아래가 잘린다
    const l = coverLayout(800, 450, 1280, 720, 90)!
    expect(l.scale).toBeCloseTo(800 / 720)
    expect(l.dispW).toBeCloseTo(800)
    expect(l.dispH).toBeCloseTo(1280 * (800 / 720))
    expect(l.offsetX).toBeCloseTo(0)
    expect(l.offsetY).toBeCloseTo((450 - l.dispH) / 2)
  })

  it('크기를 모르면 계산하지 않는다', () => {
    expect(coverLayout(0, 450, 1280, 720, 0)).toBeNull()
    expect(rotatedVideoStyle(800, 450, 0, 0, 90)).toBeNull()
  })

  it('video 요소는 원본 비율 크기로 두고 돌린 다음 거울 반전한다', () => {
    const s = rotatedVideoStyle(800, 450, 1280, 720, 90)!
    const scale = 800 / 720
    expect(s.width).toBeCloseTo(1280 * scale)
    expect(s.height).toBeCloseTo(720 * scale)
    // CSS transform 은 오른쪽부터 적용: rotate 먼저, 그다음 scaleX(-1)
    expect(s.transform).toBe('translate(-50%, -50%) scaleX(-1) rotate(90deg)')
  })

  it('상자는 표시할 때 한 번만 좌우 반전한다', () => {
    const m = mirrorBox({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })
    expect(m.x).toBeCloseTo(0.6)
    expect(m).toMatchObject({ y: 0.2, w: 0.3, h: 0.4 })
  })
})
