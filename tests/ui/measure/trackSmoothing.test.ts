import { describe, it, expect } from 'vitest'
import { MISS_LIMIT, nextPresence, NO_PRESENCE, smoothBox } from '@/features/ui/measure/demo/trackSmoothing'

describe('smoothBox', () => {
  it('처음에는 새 상자를 그대로 쓴다', () => {
    const b = { x: 0.3, y: 0.2, w: 0.2, h: 0.3 }
    expect(smoothBox(null, b)).toEqual(b)
  })

  it('조금 움직이면 반쯤 따라간다', () => {
    const r = smoothBox({ x: 0.3, y: 0.2, w: 0.2, h: 0.3 }, { x: 0.32, y: 0.2, w: 0.2, h: 0.3 })
    expect(r.x).toBeCloseTo(0.31)
  })

  it('상자 폭의 절반 넘게 움직이면 바로 새 위치로 옮긴다', () => {
    const next = { x: 0.6, y: 0.2, w: 0.2, h: 0.3 }
    expect(smoothBox({ x: 0.3, y: 0.2, w: 0.2, h: 0.3 }, next)).toEqual(next)
  })
})

describe('nextPresence', () => {
  it('찾으면 바로 있음, 연속으로 MISS_LIMIT 번 놓쳐야 없음', () => {
    let p = nextPresence(NO_PRESENCE, true)
    expect(p.present).toBe(true)
    for (let i = 1; i < MISS_LIMIT; i++) {
      p = nextPresence(p, false)
      expect(p.present).toBe(true)
    }
    p = nextPresence(p, false)
    expect(p.present).toBe(false)
  })

  it('중간에 다시 찾으면 놓친 횟수를 처음부터 센다', () => {
    let p = nextPresence(NO_PRESENCE, true)
    p = nextPresence(p, false)
    p = nextPresence(p, true)
    expect(p).toEqual({ present: true, misses: 0 })
  })

  it('처음부터 못 찾으면 없음이다', () => {
    expect(nextPresence(NO_PRESENCE, false).present).toBe(false)
  })
})
