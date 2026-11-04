import { describe, it, expect } from 'vitest'
import { fitLayout, mirrorBox, rotatedSize, rotatedVideoStyle } from '@/features/ui/measure/demo/rotationLayout'

describe('카메라 회전 좌표 규칙', () => {
  it('90°·270°이면 가로·세로가 바뀐다', () => {
    expect(rotatedSize(1280, 720, 0)).toEqual({ w: 1280, h: 720 })
    expect(rotatedSize(1280, 720, 90)).toEqual({ w: 720, h: 1280 })
    expect(rotatedSize(1280, 720, 180)).toEqual({ w: 1280, h: 720 })
    expect(rotatedSize(1280, 720, 270)).toEqual({ w: 720, h: 1280 })
  })

  it('돌린 영상을 잘리지 않게 칸 안에 통째로 넣고 가운데에 둔다', () => {
    // 가로 칸 800×450에 세운 영상(720×1280): 높이에 맞춰 s = 450/1280, 좌우는 빈 여백
    const l = fitLayout(800, 450, 1280, 720, 90)!
    expect(l.scale).toBeCloseTo(450 / 1280)
    expect(l.dispW).toBeCloseTo(720 * (450 / 1280))
    expect(l.dispH).toBeCloseTo(450)
    expect(l.offsetX).toBeCloseTo((800 - l.dispW) / 2)
    expect(l.offsetY).toBeCloseTo(0)
  })

  it('가로 웹캠(16:9)은 어느 칸 비율에서도 잘리지 않는다', () => {
    for (const [cw, ch] of [[765, 590], [990, 528], [800, 260], [400, 700]]) {
      const l = fitLayout(cw, ch, 1280, 720, 0)!
      expect(l.dispW).toBeLessThanOrEqual(cw + 1e-6)
      expect(l.dispH).toBeLessThanOrEqual(ch + 1e-6)
      expect(l.dispW / l.dispH).toBeCloseTo(1280 / 720)
      expect(Math.max(l.dispW / cw, l.dispH / ch)).toBeCloseTo(1)
    }
  })

  it('크기를 모르면 계산하지 않는다', () => {
    expect(fitLayout(0, 450, 1280, 720, 0)).toBeNull()
    expect(rotatedVideoStyle(800, 450, 0, 0, 90)).toBeNull()
  })

  it('video 요소는 원본 비율 크기로 두고 돌린 다음 거울 반전한다', () => {
    const s = rotatedVideoStyle(800, 450, 1280, 720, 90)!
    const scale = 450 / 1280
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
