import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { TimelinePoint } from './TimelineCanvas'

/**
 * 통화 한 건의 기록(데모). 측정 화면이 1초마다 표본을 쌓고, 종료 때 sessionStorage 에 넣어
 * 결과 화면으로 넘긴다. 실제 저장 계층(shared/storage)은 쓰지 않는다.
 */
export interface DemoSession {
  startedAt: number
  endedAt: number
  durationSec: number
  /** t 오름차순, 1초 간격 */
  samples: TimelinePoint[]
}

const STORAGE_KEY = 'onmaum_demo_session'

export function saveDemoSession(session: DemoSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // 저장 불가 환경이면 결과 화면이 표본 통화를 쓴다.
  }
}

/** 저장된 원문. 없거나 못 읽으면 null. 문자열이라 useSyncExternalStore 스냅샷으로 안전하다. */
export function readDemoSessionRaw(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
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

/** 결정적 난수(mulberry32). 표본 통화가 열 때마다 같은 모양이 되게 한다. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 결과 화면을 바로 열었을 때 쓰는 표본 통화. 7분 12초, 중반에 힘든 구간이 있다. */
export function makeSampleSession(): DemoSession {
  const duration = 432
  const rand = mulberry32(7)
  const samples: TimelinePoint[] = []
  let bpm = 74
  for (let t = 0; t <= duration; t += 1) {
    const f = t / duration
    let emotion: Emotion = 'calm'
    if (f >= 0.2 && f < 0.28) emotion = 'happy'
    else if (f >= 0.3 && f < 0.57) emotion = 'angry'
    else if (f >= 0.57 && f < 0.7) emotion = 'sad'
    // 화남 구간 한가운데 잠깐 평온이 끼어든다(안정화가 걸러내지 못한 짧은 전환).
    if (f >= 0.41 && f < 0.43) emotion = 'calm'
    // 심박: 기본 74, 힘든 구간 가운데가 108 근처.
    const hump = Math.exp(-(((f - 0.47) / 0.11) ** 2)) * 34
    bpm += (74 + hump - bpm) * 0.25 + (rand() - 0.5) * 2.4
    samples.push({ t, bpm: Math.round(bpm), emotion })
  }
  // 시각은 쓰지 않으므로 고정값. 렌더 중 호출해도 순수하다.
  return { startedAt: 0, endedAt: duration * 1000, durationSec: duration, samples }
}

export type CallLevel = 'low' | 'typical' | 'high' | 'veryHigh'

export interface CallSummary {
  avgBpm: number
  maxBpm: number
  /** 감정별 시간 비율 0~1 */
  shares: Record<Emotion, number>
  dominant: Emotion
  /** 가장 힘들었던 구간(초). 통화가 너무 짧으면 null */
  hardest: { start: number; end: number; peakBpm: number } | null
  level: CallLevel
}

/** 감정별 부담 가중치(표본). 실제 지수는 algorithm/stress 가 계산한다. */
const STRAIN: Record<Emotion, number> = { angry: 1, sad: 0.6, calm: 0, happy: 0 }
/** 표본 기준선: 지난 14일 통화의 평균 부담(0~1). 실제 값은 algorithm/baseline 에서 온다. */
const SAMPLE_BASELINE_STRAIN = 0.24

/** 심박을 0~1 로. 60 이하를 0, 120 이상을 1 로 본다. */
function bpmStrain(bpm: number): number {
  return Math.min(1, Math.max(0, (bpm - 60) / 60))
}

/** 통화 요약: 평균·최고 심박, 감정 비율, 우세 감정, 가장 힘들었던 구간, 평소 대비 수준. */
export function summarizeSession(session: DemoSession): CallSummary {
  const { samples, durationSec } = session
  const n = samples.length
  let sum = 0
  let maxBpm = 0
  const seconds: Record<Emotion, number> = { happy: 0, calm: 0, sad: 0, angry: 0 }
  for (const s of samples) {
    sum += s.bpm
    if (s.bpm > maxBpm) maxBpm = s.bpm
    seconds[s.emotion] += 1
  }
  const shares: Record<Emotion, number> = {
    happy: seconds.happy / n,
    calm: seconds.calm / n,
    sad: seconds.sad / n,
    angry: seconds.angry / n,
  }
  const dominant = (Object.keys(shares) as Emotion[]).reduce((a, b) => (shares[b] > shares[a] ? b : a))

  // 부담 점수: 심박 6 : 감정 4
  const strain = samples.map((s) => 0.6 * bpmStrain(s.bpm) + 0.4 * STRAIN[s.emotion])
  const meanStrain = strain.reduce((a, b) => a + b, 0) / n

  // 가장 힘들었던 구간: 통화의 15%(최소 10초) 창을 밀며 평균 부담이 가장 큰 곳
  const win = Math.max(10, Math.round(durationSec * 0.15))
  let hardest: CallSummary['hardest'] = null
  if (n > win) {
    let best = -1
    let bestStart = 0
    let acc = 0
    for (let i = 0; i < n; i += 1) {
      acc += strain[i]
      if (i >= win) acc -= strain[i - win]
      if (i >= win - 1 && acc > best) {
        best = acc
        bestStart = i - win + 1
      }
    }
    const slice = samples.slice(bestStart, bestStart + win)
    hardest = {
      start: slice[0].t,
      end: slice[slice.length - 1].t,
      peakBpm: slice.reduce((m, s) => Math.max(m, s.bpm), 0),
    }
  }

  const ratio = meanStrain / SAMPLE_BASELINE_STRAIN
  const level: CallLevel = ratio < 0.8 ? 'low' : ratio < 1.2 ? 'typical' : ratio < 1.6 ? 'high' : 'veryHigh'
  return { avgBpm: Math.round(sum / n), maxBpm, shares, dominant, hardest, level }
}

/** 판정 문장(표본). 실제 문구 선택은 feedback/lib/checkinCopy 가 맡는다. */
export const LEVEL_COPY: Record<CallLevel, string> = {
  low: '평소보다 가벼운 통화였습니다',
  typical: '평소와 비슷한 통화였습니다',
  high: '평소보다 무거운 통화였습니다',
  veryHigh: '꽤 힘든 통화였습니다',
}

export const LEVEL_SHORT: Record<CallLevel, string> = {
  low: '평소보다 가벼움',
  typical: '평소와 비슷함',
  high: '평소보다 무거움',
  veryHigh: '평소보다 훨씬 무거움',
}
