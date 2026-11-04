import { describe, expect, it } from 'vitest'
import { calibrationCandidate, fitCalibration, NEUTRAL_ONLY, validateCalibration } from '../../../scripts/analysis/emotion-ravdess/calibration.mjs'
import { metrics, replay } from '../../../scripts/analysis/emotion-ravdess/metrics.mjs'

const video = (actor: string, source: number, happy = 0.1) => ({ actor, source, intensity: 1,
  frames: Array.from({ length: 5 }, (_, i) => ({ t: i * 0.25, duration: 1.25, faceDetected: true, dominant: 'calm',
    raw: { happy, neutral: 0.7, sad: 0.05, angry: 0.05, disgusted: 0.05, fearful: 0.025, surprised: 0.025 } })) })

describe('RAVDESS 학습 보정', () => {
  it('calm 연기는 정확도와 영상 분모에서만 제외하고 검출·판정 분포는 유지한다', () => {
    const records = [video('01', 1), video('01', 2)]
    const result = metrics(records, null, true, NEUTRAL_ONLY)
    expect(result.frames).toBe(6)
    expect(result.scored).toBe(3)
    expect(result.videoCount).toBe(1)
    expect(result.source[2].predictions.calm).toBe(3)
    expect(result.calmRecall).toBeNull()
  })

  for (const kind of ['logistic', 'bias']) {
    it(`${kind} 학습은 보류 배우의 정답과 확률을 참조하지 않는다`, () => {
      const records = ['01', '03', '04'].flatMap((actor) => [video(actor, 1), video(actor, 2), video(actor, 3, 0.8)])
      const before = validateCalibration(records, kind)
      const after = validateCalibration(records.map((v) => v.actor === '04' ? video('04', 5, 0.99) : v), kind)
      if (!before.folds || !after.folds) throw new Error('배우 교차검증 결과가 없습니다')
      expect(before.folds[2].model).toEqual(after.folds[2].model)
      expect(before.folds[2].model.trainingActors).toEqual(['01', '03'])
    })

    it(`${kind} 보정은 유한한 합계 1의 확률을 내며 미검출 초기화를 보존한다`, () => {
      const record = video('01', 1)
      const candidate = calibrationCandidate(fitCalibration([record, video('01', 3, 0.8)], kind))
      const probabilities = Object.values(candidate.calibrate(record.frames[0].raw)) as number[]
      expect(probabilities.every((p) => Number.isFinite(p) && p >= 0)).toBe(true)
      expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
      const missing = { ...record.frames[0], raw: null }
      expect(replay({ ...record, frames: [record.frames[0], missing, missing, missing] }, candidate)[3].prediction).toBeNull()
    })
  }

  it('다항 회귀는 학습 배우의 확률에서 분리 가능한 클래스를 학습한다', () => {
    const happy = video('01', 3, 0.9)
    const calm = video('01', 1, 0)
    const candidate = calibrationCandidate(fitCalibration([happy, calm], 'logistic'))
    expect(metrics([happy, calm], candidate).frameAccuracy).toBe(1)
  })
})
