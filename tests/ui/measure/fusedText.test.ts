import { describe, expect, it } from 'vitest'
import { fusedRows, liveStressLevel, stressLevelText } from '@/features/ui/measure/demo/fusedText'

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
    expect(rows[1]).toEqual(['결합 근거', '표정 30 · 심박 +23 bpm(기준 72)'])
  })

  it('기준선을 아직 읽지 못했으면 절대 기준 문구', () => {
    const rows = fusedRows(true, { n: 40, hr: null, baseline: { mu: 72, sigma: 3 }, a: null, s: 40 }, null)
    expect(rows[0]).toEqual(['현재 상태', '높음 · 점수 40'])
    expect(rows[1]).toEqual(['결합 근거', '표정 40 · 심박 신호 부족'])
  })

  it('대표 심박의 출처(워치·카메라)를 심박 차이 앞에 표기한다', () => {
    const state = { n: 30, hr: 95, baseline: { mu: 72, sigma: 3 }, a: 100, s: 40.5 }
    expect(fusedRows(true, state, relative, 'watch')[1]).toEqual(['결합 근거', '표정 30 · 워치 심박 +23 bpm(기준 72)'])
    expect(fusedRows(true, state, relative, 'rppg')[1]).toEqual(['결합 근거', '표정 30 · 카메라 심박 +23 bpm(기준 72)'])
  })
})

describe('오브 아래 스트레스 단계', () => {
  const absolute = { mode: 'absolute' as const, baselineN: null }
  const state = (s: number) => ({ n: s, hr: null, baseline: null, a: null, s })

  it('측정 전이거나 점수가 없으면 단계가 없고 그에 맞는 글을 보인다', () => {
    expect(liveStressLevel(false, state(60), absolute)).toBeNull()
    expect(liveStressLevel(true, null, absolute)).toBeNull()
    expect(stressLevelText(false, null)).toBe('측정 전')
    expect(stressLevelText(true, null)).toBe('표정 수집 중')
  })

  it('결합 점수를 4단계(낮음·보통·높음·매우 높음)로 나누고 점수는 보이지 않는다', () => {
    // 기준선을 아직 못 읽었으면 절대 기준(15·30·50)
    expect(stressLevelText(true, liveStressLevel(true, state(10), null))).toBe('낮음')
    expect(stressLevelText(true, liveStressLevel(true, state(20), null))).toBe('보통')
    expect(stressLevelText(true, liveStressLevel(true, state(40), absolute))).toBe('높음')
    expect(stressLevelText(true, liveStressLevel(true, state(60), absolute))).toBe('매우 높음')
    // 개인 기준선(30)이 있으면 비율(0.8·1.25·1.6)로 나눈다
    expect(liveStressLevel(true, state(50), relative)).toBe('veryHigh')
    expect(liveStressLevel(true, state(20), relative)).toBe('low')
  })
})
