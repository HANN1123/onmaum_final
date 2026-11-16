import { describe, expect, it } from 'vitest'
import { fusedRows } from '@/features/ui/measure/demo/fusedText'

const relative = { mode: 'relative' as const, baselineN: 30 }

describe('fusedRows: 측정 화면 결합 상태 문구', () => {
  it('측정 전·표정 수집 중', () => {
    expect(fusedRows(false, null, relative)[0]).toEqual(['현재 상태', '측정 전'])
    expect(fusedRows(true, null, relative)[0]).toEqual(['현재 상태', '표정 수집 중'])
  })

  it('기준 심박을 모으는 동안은 표정 점수로만 판정한다고 알린다', () => {
    const rows = fusedRows(true, { n: 30, hr: 72, baseline: null, a: null, s: 30 }, relative)
    expect(rows[0]).toEqual(['현재 상태', '평소와 비슷함 · 점수 30'])
    expect(rows[1][1]).toContain('심박 기준 측정 중')
  })

  it('결합 점수로 4단계를 판정하고 심박 차이를 보인다', () => {
    const rows = fusedRows(true, { n: 30, hr: 95, baseline: { mu: 72, sigma: 3 }, a: 100, s: 40.5 }, relative)
    // 40.5 / 30 = 1.35 → 평소보다 높음 (표정 점수 30 만으로는 평소와 비슷함)
    expect(rows[0]).toEqual(['현재 상태', '평소보다 높음 · 점수 41'])
    expect(rows[1]).toEqual(['결합 근거', '표정 30 · 심박 +23 BPM(기준 72)'])
  })

  it('기준선을 아직 읽지 못했으면 절대 기준 문구', () => {
    const rows = fusedRows(true, { n: 40, hr: null, baseline: { mu: 72, sigma: 3 }, a: null, s: 40 }, null)
    expect(rows[0]).toEqual(['현재 상태', '높음 · 점수 40'])
    expect(rows[1]).toEqual(['결합 근거', '표정 40 · 심박 신호 부족'])
  })

  it('대표 심박의 출처(워치·카메라)를 심박 차이 앞에 표기한다', () => {
    const state = { n: 30, hr: 95, baseline: { mu: 72, sigma: 3 }, a: 100, s: 40.5 }
    expect(fusedRows(true, state, relative, 'watch')[1]).toEqual(['결합 근거', '표정 30 · 워치 심박 +23 BPM(기준 72)'])
    expect(fusedRows(true, state, relative, 'rppg')[1]).toEqual(['결합 근거', '표정 30 · 카메라 심박 +23 BPM(기준 72)'])
  })
})
