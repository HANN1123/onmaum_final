import { describe, expect, it } from 'vitest'
import { calibrationCandidate, fitCalibration } from '../../../scripts/analysis/emotion-ravdess/calibration.mjs'
import { assess, baselineProbabilities, protectedCandidate, selectThreshold, validateProtected } from '../../../scripts/analysis/emotion-ravdess/protected-calibration.mjs'

const raw = { happy: 0.1, neutral: 0.7, sad: 0.05, angry: 0.05, disgusted: 0.05, fearful: 0.025, surprised: 0.025 }
const video = (actor: string, source: number) => ({ actor, source, intensity: 1,
  frames: [{ t: 0.5, duration: 1, faceDetected: true, dominant: 'calm', raw: { ...raw } }] })
const training = ['01', '02'].flatMap((actor) => [video(actor, 1), video(actor, 2), video(actor, 3)])

describe('RAVDESS 무표정 보호 보정', () => {
  it('혼합 확률은 지정한 비율을 적용하고 합계 1을 유지한다', () => {
    const model = fitCalibration(training, 'logistic')
    const base = baselineProbabilities(raw)
    const logistic = calibrationCandidate(model).calibrate(raw)
    for (const value of [0.25, 0.5, 0.75]) {
      const result = protectedCandidate(model, 'mix', value).calibrate(raw)
      expect(result.calm).toBeCloseTo((1 - value) * base.calm + value * logistic.calm)
      expect(Object.values(result).reduce((sum: number, p: number) => sum + p, 0)).toBeCloseTo(1)
    }
  })

  it('우선 규칙은 기존 calm 확률이 임계값 이상일 때 기존 확률을 보존한다', () => {
    const model = fitCalibration(training, 'logistic')
    const probability = baselineProbabilities(raw).calm
    expect(protectedCandidate(model, 'guard', probability).calibrate(raw)).toEqual(baselineProbabilities(raw))
    expect(protectedCandidate(model, 'guard', probability + 0.01).calibrate(raw)).toEqual(calibrationCandidate(model).calibrate(raw))
    const happy = { ...raw, happy: 0.9, neutral: 0.01 }
    expect(protectedCandidate(model, 'guard', 0).calibrate(happy)).toEqual(calibrationCandidate(model).calibrate(happy))
  })

  it('가중 학습은 neutral과 calm 모두의 손실 비중을 높인다', () => {
    const unweighted = calibrationCandidate(fitCalibration(training, 'logistic')).calibrate(raw)
    for (const weight of [1.5, 2, 3]) {
      const weighted = calibrationCandidate(fitCalibration(training, 'logistic', undefined, weight)).calibrate(raw)
      expect(weighted.calm).toBeGreaterThan(unweighted.calm)
    }
  })

  it('완화 기준도 neutral 감소를 허용하지 않고 배우 여섯 명부터만 산출한다', () => {
    const baseline = { frameAccuracy: 0.8, neutralRecall: 1, calmRecall: 0.7 }
    const folds = [{ baseline, tuned: { frameAccuracy: 0.78, neutralRecall: 1, calmRecall: 0.68 } }]
    expect(assess(folds, 0.03, 5).relaxedSupportsChange).toBeNull()
    expect(assess(folds, 0.03, 6)).toMatchObject({ evidenceSupportsChange: false, relaxedSupportsChange: true })
    expect(assess([{ baseline, tuned: { ...baseline, neutralRecall: 0.99 } }], 0.03, 6).relaxedSupportsChange).toBe(false)
    expect(assess([{ baseline, tuned: baseline }], 0.019, 6).evidenceSupportsChange).toBe(false)
  })

  it('외부 보류 배우를 바꾸어도 해당 fold의 계수와 내부 임계값 선택은 바뀌지 않는다', () => {
    const records = [...training, video('03', 1), video('03', 3)]
    const before = validateProtected(records)
    const after = validateProtected(records.map((v) => v.actor === '03' ? { ...v, source: 5, frames: v.frames.map((f) => ({ ...f, raw: { ...raw, neutral: 0.01, happy: 0.99 } })) } : v))
    for (const id of Object.keys(before)) expect(before[id].folds[2].model).toEqual(after[id].folds[2].model)
    expect(before.guard.folds[2].selection).toEqual(after.guard.folds[2].selection)
    expect(before.guard.folds[2].selection?.trainingActors).toEqual(['01', '02'])
    expect(selectThreshold(training).trials.every((trial) => trial.folds.every((fold) => ['01', '02'].includes(fold.actor)))).toBe(true)
    const cache = new Map()
    expect(selectThreshold(training, cache)).toEqual(selectThreshold(training))
    expect(selectThreshold(training, cache)).toEqual(selectThreshold(training))
    const changed = training.map((v) => ({ ...v, source: 5 }))
    expect(selectThreshold(changed, cache)).toEqual(selectThreshold(changed))
  })
})
