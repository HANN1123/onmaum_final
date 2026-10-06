import { describe, it, expect } from 'vitest'
import { aggregate, type EmotionSample } from '@/lib/emotion/emotionAggregator'
import type { EmotionResult } from '@/lib/emotion/emotionAnalysis'

const END_TIME = new Date('2026-04-26T12:00:00.000+09:00')

function detected(emotion: EmotionResult, intervalMs = 500): EmotionSample {
  return { emotion, intervalMs }
}

function missed(intervalMs = 500): EmotionSample {
  return { emotion: null, intervalMs }
}

describe('aggregate', () => {
  it('빈 배열 → null 반환', () => {
    expect(aggregate([], END_TIME)).toBeNull()
  })

  it('모두 미감지 (null만) → null 반환', () => {
    const samples = [missed(), missed(), missed()]
    expect(aggregate(samples, END_TIME)).toBeNull()
  })

  it('감지 1개 → 그 값 그대로 + flatAffectScore=1', () => {
    const e: EmotionResult = { happy: 0.8, calm: 0.1, sad: 0.05, angry: 0.05 }
    const result = aggregate([detected(e)], END_TIME)
    expect(result).not.toBeNull()
    expect(result!.happy).toBeCloseTo(0.8)
    expect(result!.calm).toBeCloseTo(0.1)
    expect(result!.sad).toBeCloseTo(0.05)
    expect(result!.angry).toBeCloseTo(0.05)
    expect(result!.flatAffectScore).toBe(1)
  })

  it('모두 같은 dominant → flatAffectScore=1', () => {
    const e: EmotionResult = { happy: 0.7, calm: 0.1, sad: 0.1, angry: 0.1 }
    const samples = [detected(e), detected(e), detected(e), detected(e)]
    const result = aggregate(samples, END_TIME)
    expect(result!.flatAffectScore).toBe(1)
    expect(result!.dominantEmotion).toBe('happy')
  })

  it('dominant이 매 샘플마다 바뀜 → flatAffectScore=0', () => {
    const happy: EmotionResult = { happy: 0.9, calm: 0.05, sad: 0.025, angry: 0.025 }
    const sad: EmotionResult = { happy: 0.05, calm: 0.05, sad: 0.85, angry: 0.05 }
    const samples = [detected(happy), detected(sad), detected(happy), detected(sad)]
    const result = aggregate(samples, END_TIME)
    // 변화 횟수 = 3, 분모 = 4-1 = 3 → 1 - 3/3 = 0
    expect(result!.flatAffectScore).toBe(0)
  })

  it('4개 감정 분포 평균 계산이 정확하다', () => {
    const a: EmotionResult = { happy: 1.0, calm: 0.0, sad: 0.0, angry: 0.0 }
    const b: EmotionResult = { happy: 0.0, calm: 1.0, sad: 0.0, angry: 0.0 }
    const samples = [detected(a), detected(b)]
    const result = aggregate(samples, END_TIME)
    expect(result!.happy).toBeCloseTo(0.5)
    expect(result!.calm).toBeCloseTo(0.5)
    expect(result!.sad).toBeCloseTo(0)
    expect(result!.angry).toBeCloseTo(0)
  })

  it('dominantEmotion = 평균 4개 중 max', () => {
    const e1: EmotionResult = { happy: 0.6, calm: 0.2, sad: 0.1, angry: 0.1 }
    const e2: EmotionResult = { happy: 0.0, calm: 0.0, sad: 0.5, angry: 0.5 }
    const samples = [detected(e1), detected(e2)]
    const result = aggregate(samples, END_TIME)
    // 평균: happy=0.3, calm=0.1, sad=0.3, angry=0.3 → tie. EMOTION_ORDER 순서상 첫 max 선택
    expect(['happy', 'sad', 'angry']).toContain(result!.dominantEmotion)
  })

  it('duration = 감지된 sample의 intervalMs 합', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const samples = [detected(e, 500), missed(500), detected(e, 500), missed(500)]
    const result = aggregate(samples, END_TIME)
    expect(result!.duration).toBe(1000) // 500 + 500
  })

  it('detectionRate = duration / 모든 sample intervalMs 합', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const samples = [detected(e, 500), missed(500), detected(e, 500), missed(500)]
    const result = aggregate(samples, END_TIME)
    expect(result!.detectionRate).toBeCloseTo(0.5) // 1000 / 2000
  })

  it('감지 샘플 1개일 때 flatAffectScore=1 (분모 0 회피)', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const samples = [missed(), detected(e), missed()]
    const result = aggregate(samples, END_TIME)
    expect(result!.flatAffectScore).toBe(1)
  })

  it('endTime이 timestamp에 정확히 반영', () => {
    const e: EmotionResult = { happy: 1, calm: 0, sad: 0, angry: 0 }
    const result = aggregate([detected(e)], END_TIME)
    expect(result!.timestamp.getTime()).toBe(END_TIME.getTime())
  })

  it('미감지 샘플은 flatAffect 변화 카운트에서 제외 (감지된 것 사이만)', () => {
    const happy: EmotionResult = { happy: 0.9, calm: 0.05, sad: 0.025, angry: 0.025 }
    const sad: EmotionResult = { happy: 0.05, calm: 0.05, sad: 0.85, angry: 0.05 }
    // 감지: happy, happy, sad → 변화 1회, 분모 = 3-1=2 → flatAffect = 1 - 1/2 = 0.5
    const samples = [detected(happy), missed(), detected(happy), missed(), detected(sad)]
    const result = aggregate(samples, END_TIME)
    expect(result!.flatAffectScore).toBeCloseTo(0.5)
  })
})
