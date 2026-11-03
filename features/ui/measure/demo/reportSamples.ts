import type { StressLevel } from '@/features/algorithm/baseline/baseline'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { DailyStressPoint } from '@/features/algorithm/stress/dailyStress'
import { SAMPLE_TODAY } from './demoCopy'

/**
 * 리포트 데모의 표본 데이터. 실제 값은 shared/storage 의 기록에서 algorithm 이 계산한다.
 * 판정 자체는 표본이 아니라 algorithm/baseline 의 함수로 한다.
 */

/** 지난 14일(오래된→오늘). null 은 측정이 없던 날. 마지막은 오늘이라 SAMPLE_TODAY 와 같다. */
const HISTORY: ({ positive: number; stress: number; minutes: number } | null)[] = [
  { positive: 38, stress: 29, minutes: 96 },
  { positive: 35, stress: 34, minutes: 110 },
  null,
  { positive: 44, stress: 26, minutes: 88 },
  { positive: 31, stress: 41, minutes: 123 },
  { positive: 36, stress: 33, minutes: 101 },
  { positive: 40, stress: 28, minutes: 79 },
  null,
  { positive: 33, stress: 37, minutes: 115 },
  { positive: 29, stress: 46, minutes: 131 },
  { positive: 39, stress: 31, minutes: 94 },
  { positive: 42, stress: 24, minutes: 72 },
  { positive: 37, stress: 30, minutes: 99 },
  { positive: SAMPLE_TODAY.positive, stress: SAMPLE_TODAY.stress, minutes: 72 },
]

/** today 를 마지막 날로 하는 14일 표본. algorithm/baseline 의 computeBaselineState 에 그대로 넣는다. */
export function sampleHistory(today: Date): DailyStressPoint[] {
  return HISTORY.map((day, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (HISTORY.length - 1 - i))
    return {
      date: d.toLocaleDateString('en-CA'),
      scores: day ? { positive: day.positive, stress: day.stress } : null,
      totalDuration: day ? day.minutes * 60 * 1000 : 0,
    }
  })
}

export interface SampleCall {
  time: string
  durationSec: number
  level: StressLevel
  emotion: Emotion
}

/** 오늘 통화 표본(지금부터 몇 분 전에 끝났는지), 최근 것이 먼저. */
const CALLS: { minutesAgo: number; durationSec: number; level: StressLevel; emotion: Emotion }[] = [
  { minutesAgo: 34, durationSec: 348, level: 'low', emotion: 'calm' },
  { minutesAgo: 76, durationSec: 555, level: 'high', emotion: 'sad' },
  { minutesAgo: 108, durationSec: 362, level: 'typical', emotion: 'calm' },
  { minutesAgo: 171, durationSec: 751, level: 'high', emotion: 'angry' },
  { minutesAgo: 236, durationSec: 252, level: 'low', emotion: 'happy' },
  { minutesAgo: 289, durationSec: 460, level: 'typical', emotion: 'calm' },
]

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** now 를 기준으로 시각을 매긴 오늘 통화 표본. */
export function sampleCalls(now: Date): SampleCall[] {
  return CALLS.map((c) => ({
    time: formatClock(new Date(now.getTime() - c.minutesAgo * 60 * 1000)),
    durationSec: c.durationSec,
    level: c.level,
    emotion: c.emotion,
  }))
}

/** 가장 힘들었던 시간대의 시작 시각: 두 시간 전이 든 2시간 구간. 실제 값은 dailyStress.hardestPeriod 가 준다. */
export function sampleHardestHour(now: Date): number {
  const hour = (now.getHours() - 2 + 24) % 24
  return Math.floor(hour / 2) * 2
}
export const SAMPLE_SHARES: Record<Emotion, number> = { calm: 61, happy: 12, sad: 9, angry: 18 }
export const SAMPLE_AVG_BPM = 78

/** 하루 판정 문장(표본). 실제 문구는 feedback/lib/checkinCopy 가 고른다. */
export const DAY_LEVEL_COPY: Record<StressLevel, string> = {
  low: '평소보다 가벼운 하루입니다',
  typical: '평소와 비슷한 하루입니다',
  high: '평소보다 무거운 하루입니다',
  veryHigh: '많이 무거운 하루입니다',
}
