import { describe, expect, it } from 'vitest'
import { candidates, crossValidate, metrics, replay } from '../../../scripts/analysis/emotion-ravdess/metrics.mjs'
import { getDominantEmotion, normalizeExpressions } from '@/features/algorithm/emotion/emotionAnalysis'
import { smoothEmotion } from '@/features/algorithm/emotion/emotionSmoothing'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'

const raw = (neutral = 0.6, happy = 0.1) => ({ neutral, happy, sad: 0.1, angry: 0.1, disgusted: 0.1, fearful: 0, surprised: 0 })
function video(actor: string, source: number, probabilities = [raw(), raw(), raw(), raw(), raw()]) {
  let ema: EmotionResult | null = null
  return { actor, source, intensity: 1, frames: probabilities.map((r, index) => {
    const normalized = normalizeExpressions(r)
    ema = smoothEmotion(ema, normalized)
    return { t: index * 0.25, duration: 1.25, raw: r, faceDetected: true, normalized, smoothed: ema, dominant: getDominantEmotion(ema) }
  }) }
}

describe('RAVDESS 평가 지표', () => {
  it('가운데 60%와 전체 프레임의 분모를 분리한다', () => {
    const record = video('01', 1)
    expect(metrics([record]).frames).toBe(3)
    expect(metrics([record], null, false).frames).toBe(5)
    expect(metrics([record]).neutralRecall).toBe(1)
    expect(metrics([record]).calmRecall).toBeNull()
  })

  it('fearful·surprised는 정확도에서 제외하고 판정 분포만 센다', () => {
    const result = metrics([video('01', 6), video('01', 8)])
    expect(result.frameAccuracy).toBeNull()
    expect(result.videoCount).toBe(0)
    expect(result.source[6].predictions.calm).toBe(3)
    expect(result.source[8].predictions.calm).toBe(3)
  })

  it('미검출은 오답에 포함하고 정밀도의 분모에서는 제외한다', () => {
    const record = video('01', 1)
    const missing = { ...record, frames: record.frames.map((frame) => ({ ...frame, faceDetected: false, raw: null, dominant: null })) }
    const result = metrics([record, missing])
    expect(result.frameAccuracy).toBe(0.5)
    expect(result.conditionalAccuracy).toBe(1)
    expect(result.videoAccuracy).toBe(0.5)
    expect(result.faceDetectionRate).toBe(0.5)
    expect(result.confusion.calm.missing).toBe(3)
    expect(result.byEmotion.calm.precision).toBe(1)
  })

  it('기본 후보 재생이 실제 정규화·EMA 경로와 일치하며 영상마다 초기화한다', () => {
    const record = video('01', 3, [raw(), raw(0.1, 0.6), raw(0.1, 0.6), raw(), raw()])
    const result = replay(record, candidates()[0])
    expect(result.map((frame: { prediction: string | null }) => frame.prediction)).toEqual(record.frames.map((frame) => frame.dominant))
    expect(replay(video('02', 1), candidates()[0])[0].prediction).toBe('calm')
  })

  it('세 번 연속 미검출 뒤 EMA와 투표 창을 초기화한다', () => {
    const record = video('01', 1)
    const missing = { ...record.frames[0], raw: null, faceDetected: false, dominant: null }
    const sequence = { ...record, frames: [record.frames[0], missing, missing, missing, { ...record.frames[0], raw: raw(0, 0.9) }] }
    expect(replay(sequence, candidates()[0]).map((frame: { prediction: string | null }) => frame.prediction)).toEqual(['calm', 'calm', 'calm', null, 'happy'])
  })

  it('배우가 부족하면 교차검증 점수를 만들지 않는다', () => {
    expect(crossValidate([video('01', 1), video('01', 2)]).status).toBe('insufficient-actors')
  })

  it('보류 배우의 정답을 바꿔도 해당 fold의 후보 선택이 바뀌지 않는다', () => {
    const records = ['01', '02', '03'].flatMap((actor) => [video(actor, 1), video(actor, 2), video(actor, 3)])
    const before = crossValidate(records)
    const after = crossValidate(records.map((record) => record.actor === '03' ? { ...record, source: 5 } : record))
    expect(before.folds?.[2].trainingActors).toEqual(['01', '02'])
    expect(before.folds?.[2].selected).toEqual(after.folds?.[2].selected)
    expect(before.folds?.[2].trainingTrials).toEqual(after.folds?.[2].trainingTrials)
    expect(before.evidenceSupportsChange).toBe(false)
  })
})
