import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { RppgQuality } from '@/features/rppg/engine/rppgGate'
import { cleanBpmSeries } from '@/features/rppg/lib/bpmCleaning'

/** 측정 중 1초마다 남기는 표본. */
export interface TimelinePoint {
  /** 측정 시작부터 지난 초 */
  t: number
  /** 심박(BPM). rPPG 연결 전이거나 신호를 잃으면 null */
  bpm: number | null
  /** 없으면 이전 형식의 좋은 값으로 취급한다 */
  quality?: RppgQuality
  /** 표시 보정 전 값. 이전 형식에는 없다 */
  rawBpm?: number | null
  /** 그 순간의 안정된 감정. 얼굴을 찾지 못했으면 null */
  emotion: Emotion | null
}

/**
 * 측정 한 번의 기록(데모). 측정 화면이 1초마다 표본을 쌓고, 종료 때 sessionStorage 에 넣어
 * 결과 화면으로 넘긴다. 실제 저장 계층(shared/storage)에는 저장하지 않는다.
 */
export interface DemoSession {
  startedAt: number
  endedAt: number
  durationSec: number
  /** t 오름차순 */
  samples: TimelinePoint[]
}

export const DEMO_SESSION_KEY = 'onmaum_demo_session'

export function saveDemoSession(session: DemoSession): void {
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session))
  } catch {
    // 저장할 수 없는 환경이면 결과 화면이 "기록 없음"을 보여준다.
  }
}

/** 저장된 원문. 없거나 못 읽으면 null. 문자열이라 useSyncExternalStore 스냅샷으로 안전하다. */
export function readDemoSessionRaw(): string | null {
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY)
  } catch {
    return null
  }
}

export function parseDemoSession(raw: string | null): DemoSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DemoSession
    if (!Array.isArray(parsed.samples) || parsed.samples.length < 2 || !(parsed.durationSec > 0)) return null
    return parsed
  } catch {
    return null
  }
}

/** 같은 로컬 날짜인지. 리포트·기록의 "오늘"에 어제 끝낸 측정이 섞이지 않게 한다. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export interface SessionSummary {
  /** 심박 표본 평균·최고. 심박 표본이 하나도 없으면(rPPG 연결 전) null */
  avgBpm: number | null
  maxBpm: number | null
  /** 얼굴을 찾은 표본 중 감정별 비율 0~1. 찾은 표본이 없으면 모두 0 */
  shares: Record<Emotion, number>
  /** 가장 오래 머문 감정. 얼굴을 한 번도 찾지 못했으면 null */
  dominant: Emotion | null
  /** 전체 표본 중 얼굴을 찾은 비율 0~1 */
  detectedRatio: number
  /** 심박이 가장 높았던 구간(초). 심박 표본이 없거나 측정이 짧으면 null */
  peakWindow: { start: number; end: number; peakBpm: number } | null
}

/**
 * 이보다 짧은 측정은 심박이 가장 높았던 구간을 표시하지 않는다(초). 구간 창이 최소 10초라,
 * 20초 미만이면 창이 측정의 절반을 넘어 "가장 높았던 구간"이라는 말이 무의미해진다.
 */
const MIN_PEAK_SESSION_SEC = 20

/**
 * 측정 요약: 실제로 기록된 값만 센다. 얼굴을 못 찾은 표본은 감정 비율에서 빼고, 심박이 없으면 심박 값을 만들지 않는다.
 * 스트레스 판정이나 기준선 비교는 하지 않는다(판정은 algorithm/baseline 이 저장된 기록으로 한다).
 */
export function summarizeSession(session: DemoSession): SessionSummary {
  const { durationSec } = session
  const samples = cleanBpmSeries(session.samples)
  const seconds: Record<Emotion, number> = { happy: 0, calm: 0, sad: 0, angry: 0 }
  let detected = 0
  let bpmSum = 0
  let bpmCount = 0
  let maxBpm: number | null = null
  for (const s of samples) {
    if (s.emotion) {
      seconds[s.emotion] += 1
      detected += 1
    }
    if (s.bpm !== null) {
      bpmSum += s.bpm
      bpmCount += 1
      if (maxBpm === null || s.bpm > maxBpm) maxBpm = s.bpm
    }
  }
  const share = (e: Emotion) => (detected > 0 ? seconds[e] / detected : 0)
  const shares: Record<Emotion, number> = { happy: share('happy'), calm: share('calm'), sad: share('sad'), angry: share('angry') }
  const dominant =
    detected > 0 ? (Object.keys(seconds) as Emotion[]).reduce((a, b) => (seconds[b] > seconds[a] ? b : a)) : null

  return {
    avgBpm: bpmCount > 0 ? Math.round(bpmSum / bpmCount) : null,
    maxBpm,
    shares,
    dominant,
    detectedRatio: samples.length > 0 ? detected / samples.length : 0,
    peakWindow: findPeakWindow(samples, durationSec),
  }
}

/** 측정의 15%(최소 10초) 창을 밀며 평균 심박이 가장 높은 곳. 심박이 빠진 표본은 건너뛴다. */
function findPeakWindow(samples: TimelinePoint[], durationSec: number): SessionSummary['peakWindow'] {
  const win = Math.max(10, Math.round(durationSec * 0.15))
  if (durationSec < MIN_PEAK_SESSION_SEC || samples.length <= win) return null
  // 심박이 절반 넘게 비어 있으면 구간을 고르지 않는다.
  if (samples.filter((s) => s.bpm !== null).length < samples.length / 2) return null
  let best = -Infinity
  let bestStart = -1
  for (let i = 0; i + win <= samples.length; i += 1) {
    let sum = 0
    let n = 0
    for (let k = i; k < i + win; k += 1) {
      const bpm = samples[k].bpm
      if (bpm !== null) {
        sum += bpm
        n += 1
      }
    }
    if (n > 0 && sum / n > best) {
      best = sum / n
      bestStart = i
    }
  }
  if (bestStart < 0) return null
  const slice = samples.slice(bestStart, bestStart + win)
  return {
    start: slice[0].t,
    end: slice[slice.length - 1].t,
    peakBpm: slice.reduce((m, s) => (s.bpm !== null && s.bpm > m ? s.bpm : m), 0),
  }
}

/**
 * 가운데 정렬 이동 평균. 1초 표본의 잔떨림을 걷어 선을 매끈하게 한다.
 * 심박이 빠진 자리는 이웃 값으로 메우지 않고 null 로 둔다(선이 끊긴다).
 */
export function smoothBpm(values: (number | null)[]): (number | null)[] {
  const half = values.length > 60 ? 4 : 1
  return values.map((value, i) => {
    if (value === null) return null
    let sum = 0
    let n = 0
    for (let k = Math.max(0, i - half); k <= Math.min(values.length - 1, i + half); k += 1) {
      const v = values[k]
      if (v !== null) {
        sum += v
        n += 1
      }
    }
    return sum / n
  })
}

/** 강조 구간과 그 구간에서 가장 오래 머문 감정(구간의 색). 얼굴을 못 찾은 구간이면 감정은 null */
export function peakWithEmotion(
  session: DemoSession,
  summary: SessionSummary,
): { start: number; end: number; emotion: Emotion | null } | null {
  if (!summary.peakWindow) return null
  const { start, end } = summary.peakWindow
  const count: Record<Emotion, number> = { happy: 0, calm: 0, sad: 0, angry: 0 }
  let any = false
  for (const s of session.samples) {
    if (s.t >= start && s.t <= end && s.emotion) {
      count[s.emotion] += 1
      any = true
    }
  }
  const emotion = any ? (Object.keys(count) as Emotion[]).reduce((a, b) => (count[b] > count[a] ? b : a)) : null
  return { start, end, emotion }
}
