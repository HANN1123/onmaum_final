import type { EmotionResult } from '../emotion/emotionAnalysis'
import { ANGRY_WEIGHT } from './riskCalculator'

export function frameContribution(e: EmotionResult): { pos: number; neg: number } {
  return { pos: e.happy, neg: e.sad + e.angry * ANGRY_WEIGHT }
}

export interface StressScores {
  positive: number // 0~100
  stress: number // 0~100
}

interface StressInput {
  happy: number
  sad: number
  angry: number
  duration: number
}

export function aggregateStress(records: StressInput[]): StressScores | null {
  const total = records.reduce((sum, r) => sum + r.duration, 0)
  if (records.length === 0 || total <= 0) return null

  let weightedPos = 0
  let weightedNeg = 0
  for (const r of records) {
    weightedPos += r.happy * r.duration
    weightedNeg += (r.sad + r.angry * ANGRY_WEIGHT) * r.duration
  }
  return {
    positive: (100 * weightedPos) / total,
    stress: (100 * weightedNeg) / total,
  }
}

export function mindBalance(s: StressScores): number {
  return s.positive - s.stress
}

export function affectEnergy(s: StressScores): number {
  return s.positive + s.stress
}

export const NEG_PRESENT_THRESHOLD = 0.4
export const MIN_SUSTAIN_MS = 3000

export interface NegFrame {
  neg: number
  intervalMs: number
}

/**
 * 부정(neg ≥ negThreshold)이 minSustainMs 이상 "연속"된 구간만 neg를 유지하고,
 * 짧게 튄 스파이크나 임계 미만 프레임은 0으로 만든다. (spec §4: 지속된 부정만 인정)
 */
export function gateSustainedNegative(
  frames: NegFrame[],
  opts?: { negThreshold?: number; minSustainMs?: number },
): number[] {
  const negThreshold = opts?.negThreshold ?? NEG_PRESENT_THRESHOLD
  const minSustainMs = opts?.minSustainMs ?? MIN_SUSTAIN_MS

  const out = frames.map(() => 0)
  let i = 0
  while (i < frames.length) {
    if (frames[i].neg >= negThreshold) {
      let j = i
      let runMs = 0
      while (j < frames.length && frames[j].neg >= negThreshold) {
        runMs += frames[j].intervalMs
        j++
      }
      if (runMs >= minSustainMs) {
        for (let k = i; k < j; k++) out[k] = frames[k].neg
      }
      i = j
    } else {
      i++
    }
  }
  return out
}

export const EMA_ALPHA = 0.3

/** 지금값(현재 상태) 스무딩 — 최근 값에 가중. prev가 null이면 현재값으로 시작. */
export function emaStress(
  prev: number | null,
  current: number,
  alpha: number = EMA_ALPHA,
): number {
  return prev === null ? current : prev + alpha * (current - prev)
}
