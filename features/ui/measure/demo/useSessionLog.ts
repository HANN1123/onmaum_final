import { useCallback, useEffect, useRef } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { RppgQuality } from '@/features/rppg/engine/rppgGate'
import { selectHeartRate, type WatchSample, type WatchConnectionStatus } from '@/features/rppg/lib/heartRateSource'
import { saveDemoSession, type DemoSession, type TimelinePoint } from './sessionLog'

/**
 * 측정 중 1초마다 (경과 초, 심박, 감정)을 쌓는다. 심박이 없거나 얼굴을 못 찾은 순간은 null 로 남긴다.
 * 돌려주는 finish() 가 마지막 표본을 더해 기록을 sessionStorage 에 넣고 측정 한 번을 반환한다.
 * 최신 값은 ref 로 들고 있어 interval 콜백이 렌더와 무관하게 읽는다.
 */
export interface SessionLogSources {
  latest: WatchSample | null
  status: WatchConnectionStatus
  rppgBpm: number | null
}

export function useSessionLog(active: boolean, bpm: number | null, emotion: Emotion | null, quality: RppgQuality | null = null, rawBpm?: number | null, sources?: SessionLogSources): () => DemoSession {
  const latest = useRef({ bpm, emotion, quality: quality ?? undefined, rawBpm, sources })
  const samples = useRef<TimelinePoint[]>([])
  const startedAt = useRef(0)

  useEffect(() => {
    latest.current = { bpm, emotion, quality: quality ?? undefined, rawBpm, sources }
  }, [bpm, emotion, quality, rawBpm, sources])

  const sample = useCallback((t: number): TimelinePoint => {
    const { sources: input, ...metadata } = latest.current
    if (!input) return { t, ...metadata }
    const now = performance.now()
    // 표본 채집 시각에 다시 선택해 화면 갱신·타이머 순서에 따른 만료 오차를 피한다.
    const selected = selectHeartRate({ ...input, now, rppgQuality: metadata.quality ?? null })
    const age = input.latest ? now - input.latest.t : null
    return { t, ...metadata, bpm: selected.bpm, source: selected.source ?? undefined,
      rppgBpm: input.rppgBpm, watchBpm: input.latest?.bpm ?? null,
      watchAgeMs: age !== null && Number.isFinite(age) ? age : null,
      watchContact: input.latest?.contact ?? null }
  }, [])

  useEffect(() => {
    if (!active) return
    startedAt.current = Date.now()
    samples.current = [sample(0)]
    const timer = setInterval(() => {
      const t = Math.round((Date.now() - startedAt.current) / 1000)
      samples.current.push(sample(t))
    }, 1000)
    return () => clearInterval(timer)
  }, [active, sample])

  return useCallback((): DemoSession => {
    const endedAt = Date.now()
    const durationSec = Math.max(1, Math.round((endedAt - startedAt.current) / 1000))
    const recorded = samples.current.slice()
    // 종료 순간을 마지막 표본으로 더한다. 1초 안에 끝내도 표본이 둘이 되어 결과 화면이 이 측정을 보여준다.
    if (recorded[recorded.length - 1]?.t !== durationSec) {
      recorded.push(sample(durationSec))
    }
    const session: DemoSession = { startedAt: startedAt.current, endedAt, durationSec, samples: recorded }
    saveDemoSession(session)
    return session
  }, [sample])
}
