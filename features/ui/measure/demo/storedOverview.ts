import {
  BASELINE_WINDOW_DAYS,
  classifyStress,
  computeBaselineState,
  type BaselineState,
  type StressLevel,
} from '@/features/algorithm/baseline/baseline'
import { applyOffset } from '@/features/algorithm/baseline/calibration'
import { getDominantEmotion, type Emotion, type EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { dailyStressHistory, hardestPeriod, type DailyStressPoint } from '@/features/algorithm/stress/dailyStress'
import { aggregateStress, type StressScores } from '@/features/algorithm/stress/stressIndex'
import type { EmotionRecord, MeasurementSession } from '@/shared/storage/db'

/**
 * 리포트·기록·측정 데모가 보여줄 "저장된 실제 기록"의 요약.
 * 계산은 모두 algorithm 의 기존 함수(dailyStressHistory, computeBaselineState, classifyStress, applyOffset,
 * aggregateStress, hardestPeriod, getDominantEmotion)를 그대로 부른다. 새 판정 규칙은 만들지 않는다.
 * 오늘의 스트레스·판정은 기존 리포트(DailyReport)와 같이 체크인 보정값(offset)을 더한 값으로 한다.
 */

export interface StoredDay {
  /** YYYY-MM-DD (로컬) */
  date: string
  isToday: boolean
  /** 화면에 보일 스트레스(0~100, 반올림 전). 기록이 없으면 null. 오늘만 보정값을 더한다 */
  stress: number | null
  /** 저장된 감정 기록의 측정 시간 합(분) */
  minutes: number
  /** 그날 시작한 측정 세션 수 */
  sessions: number
  level: StressLevel | null
}

export interface TodaySession {
  id: string
  startedAt: Date
  durationSec: number
  /** 측정이 아직 진행 중인 세션 */
  active: boolean
  /** 그 세션 기록의 평균 감정에서 가장 큰 감정. 기록이 없으면 null */
  dominant: Emotion | null
  /** 그 세션 기록의 스트레스 지수. 기록이 없으면 null */
  stress: number | null
}

export interface StoredOverview {
  history: DailyStressPoint[]
  baseline: BaselineState
  /** 오래된 날 → 오늘 */
  days: StoredDay[]
  today: {
    scores: StressScores | null
    /** 보정값을 더한 오늘 스트레스. 기록이 없으면 null */
    stress: number | null
    level: StressLevel | null
    /** 오늘 기록의 평균 감정 비율 0~1. 기록이 없으면 null */
    shares: Record<Emotion, number> | null
    /** 2시간 단위 시간대 중 스트레스가 가장 높았던 시간대의 시작 시각. 고를 시간대가 없으면 null */
    hardestStartHour: number | null
    /** 최근 것이 먼저 */
    sessions: TodaySession[]
  }
  /** 기준선 계산에 쓴 유효한 날 수(오늘 제외) */
  validDays: number
}

function localDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

/** 측정 시간으로 가중한 평균 감정. 기록이 없으면 null (기존 DailyReport 의 평균과 같은 방식) */
export function averageEmotion(records: EmotionRecord[]): EmotionResult | null {
  const total = records.reduce((sum, r) => sum + r.duration, 0)
  if (total <= 0) return null
  const acc = { happy: 0, calm: 0, sad: 0, angry: 0 }
  for (const r of records) {
    acc.happy += r.happy * r.duration
    acc.calm += r.calm * r.duration
    acc.sad += r.sad * r.duration
    acc.angry += r.angry * r.duration
  }
  return { happy: acc.happy / total, calm: acc.calm / total, sad: acc.sad / total, angry: acc.angry / total }
}

/** 최근 BASELINE_WINDOW_DAYS 일(오늘 포함)의 감정 기록·세션으로 화면용 요약을 만든다. */
export function buildStoredOverview(
  records: EmotionRecord[],
  sessions: MeasurementSession[],
  now: Date,
  offset: number,
): StoredOverview {
  const history = dailyStressHistory(records, BASELINE_WINDOW_DAYS, now)
  const baseline = computeBaselineState(history)
  const todayKey = localDateKey(now)

  const sessionCount = new Map<string, number>()
  for (const s of sessions) {
    const key = localDateKey(s.startedAt)
    sessionCount.set(key, (sessionCount.get(key) ?? 0) + 1)
  }

  const days: StoredDay[] = history.map((p) => {
    const isToday = p.date === todayKey
    const raw = p.scores?.stress ?? null
    const stress = raw === null ? null : isToday ? applyOffset(raw, offset) : raw
    return {
      date: p.date,
      isToday,
      stress,
      minutes: Math.round(p.totalDuration / 60000),
      sessions: sessionCount.get(p.date) ?? 0,
      level: stress === null ? null : classifyStress(stress, baseline),
    }
  })

  const todayRecords = records.filter((r) => localDateKey(r.timestamp) === todayKey)
  const todayDay = days[days.length - 1]
  const avg = averageEmotion(todayRecords)
  const hard = hardestPeriod(todayRecords)

  const bySession = new Map<string, EmotionRecord[]>()
  for (const r of todayRecords) {
    if (!r.sessionId) continue
    const arr = bySession.get(r.sessionId) ?? []
    arr.push(r)
    bySession.set(r.sessionId, arr)
  }
  const todaySessions: TodaySession[] = sessions
    .filter((s) => localDateKey(s.startedAt) === todayKey)
    .map((s) => {
      const own = bySession.get(s.id) ?? []
      const ownAvg = averageEmotion(own)
      const end = s.endedAt ?? s.lastSeenAt
      return {
        id: s.id,
        startedAt: s.startedAt,
        durationSec: Math.max(0, Math.round((end.getTime() - s.startedAt.getTime()) / 1000)),
        active: s.status === 'active',
        dominant: ownAvg ? getDominantEmotion(ownAvg) : null,
        stress: aggregateStress(own)?.stress ?? null,
      }
    })
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())

  return {
    history,
    baseline,
    days,
    today: {
      scores: aggregateStress(todayRecords),
      stress: todayDay?.stress ?? null,
      level: todayDay?.level ?? null,
      shares: avg,
      hardestStartHour: hard ? hard.startHour : null,
      sessions: todaySessions,
    },
    validDays: history.slice(0, -1).filter((p) => p.scores !== null).length,
  }
}

/** 판정 짧은 글. 기준선이 없으면(기록 3일 미만) "평소" 비교 표현을 쓰지 않는다 (DailyReport 와 같은 기준). */
export function levelShort(level: StressLevel, baseline: BaselineState): string {
  if (baseline.mode !== 'relative') return ABSOLUTE_SHORT[level]
  return RELATIVE_SHORT[level]
}

const RELATIVE_SHORT: Record<StressLevel, string> = {
  low: '평소보다 가벼움',
  typical: '평소와 비슷함',
  high: '평소보다 높음',
  veryHigh: '평소보다 많이 높음',
}

const ABSOLUTE_SHORT: Record<StressLevel, string> = {
  low: '가벼움',
  typical: '보통',
  high: '높음',
  veryHigh: '많이 높음',
}

/** 하루 판정 문장. 기준선이 없으면 절대 기준 문장 */
export function dayLevelCopy(level: StressLevel, baseline: BaselineState): string {
  if (baseline.mode !== 'relative') return ABSOLUTE_DAY[level]
  return RELATIVE_DAY[level]
}

const RELATIVE_DAY: Record<StressLevel, string> = {
  low: '평소보다 가벼운 하루입니다',
  typical: '평소와 비슷한 하루입니다',
  high: '평소보다 무거운 하루입니다',
  veryHigh: '많이 무거운 하루입니다',
}

const ABSOLUTE_DAY: Record<StressLevel, string> = {
  low: '가벼운 하루입니다',
  typical: '보통인 하루입니다',
  high: '무거운 하루입니다',
  veryHigh: '많이 무거운 하루입니다',
}
