import { describe, expect, it } from 'vitest'
import { OFF_READING, type RppgReading } from '@/features/rppg/engine/rppgGate'
import { faceRateText, heartSourceText, recordStateText, signalQualityText } from '@/features/ui/measure/demo/monitorText'

const live: RppgReading = { ...OFF_READING, status: 'live', snrDb: 1.94, bpm: 76, rawBpm: 76, quality: 'good' }
const consent = (record: boolean) => ({ version: 1 as const, record, decidedAt: '2026-11-20T00:00:00.000Z' })

describe('모니터링 Info 행 글', () => {
  it('심박 신호 품질은 SNR 과, 워치가 정상일 때만 워치와의 bpm 차이를 보인다', () => {
    expect(signalQualityText(false, live, null, null)).toBe('카메라 대기')
    expect(signalQualityText(true, live, null, 76)).toBe('SNR 1.9 dB')
    expect(signalQualityText(true, live, 73, 76)).toBe('SNR 1.9 dB · 워치 차이 +3 bpm')
    expect(signalQualityText(true, live, 78, 76)).toBe('SNR 1.9 dB · 워치 차이 −2 bpm')
    // SNR 이 아직 없으면 엔진 상태
    expect(signalQualityText(true, { ...OFF_READING, status: 'warming' }, null, null)).toBe('신호 모으는 중')
  })

  it('얼굴 검출률은 백분율만 보인다', () => {
    expect(faceRateText(true, 0.874)).toBe('87%')
    expect(faceRateText(true, null)).toBe('—')
    expect(faceRateText(false, 0.9)).toBe('카메라 대기')
  })

  it('심박 측정 방식은 워치 또는 rPPG 이고, 워치 문제는 카메라로 재는 동안에만 짧게 덧붙인다', () => {
    expect(heartSourceText(true, 'watch', 'live')).toBe('워치')
    expect(heartSourceText(true, 'rppg', 'idle')).toBe('rPPG')
    expect(heartSourceText(true, 'rppg', 'stale')).toBe('rPPG · 워치 신호 없음')
    expect(heartSourceText(false, null, 'idle')).toBe('—')
  })

  it('기록 여부는 대기 중·저장 중 두 가지이고, 저장 실패는 숨기지 않는다', () => {
    expect(recordStateText(undefined, true, null)).toBe('확인 중')
    expect(recordStateText(null, true, null)).toBe('대기 중')
    expect(recordStateText(consent(false), true, null)).toBe('대기 중')
    expect(recordStateText(consent(true), false, null)).toBe('대기 중')
    expect(recordStateText(consent(true), true, { saved: 2, failed: false, sessionId: null })).toBe('저장 중')
    expect(recordStateText(consent(true), true, { saved: 2, failed: true, sessionId: null })).toBe('저장 실패')
  })
})
