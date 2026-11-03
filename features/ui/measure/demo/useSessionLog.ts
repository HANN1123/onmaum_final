import { useCallback, useEffect, useRef } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { saveDemoSession, type DemoSession } from './sessionLog'
import type { TimelinePoint } from './TimelineCanvas'

/**
 * 통화 중 1초마다 (경과 초, BPM, 안정된 감정)을 쌓는다.
 * 돌려주는 finish() 가 기록을 sessionStorage 에 넣고 통화 한 건을 반환한다.
 * 최신 값은 ref 로 들고 있어 interval 콜백이 렌더와 무관하게 읽는다.
 */
export function useSessionLog(active: boolean, bpm: number, emotion: Emotion): () => DemoSession {
  const latest = useRef({ bpm, emotion })
  const samples = useRef<TimelinePoint[]>([])
  const startedAt = useRef(0)

  useEffect(() => {
    latest.current = { bpm, emotion }
  }, [bpm, emotion])

  useEffect(() => {
    if (!active) return
    startedAt.current = Date.now()
    samples.current = [{ t: 0, bpm: latest.current.bpm, emotion: latest.current.emotion }]
    const timer = setInterval(() => {
      const t = Math.round((Date.now() - startedAt.current) / 1000)
      samples.current.push({ t, bpm: latest.current.bpm, emotion: latest.current.emotion })
    }, 1000)
    return () => clearInterval(timer)
  }, [active])

  return useCallback((): DemoSession => {
    const endedAt = Date.now()
    const durationSec = Math.max(1, Math.round((endedAt - startedAt.current) / 1000))
    const session: DemoSession = {
      startedAt: startedAt.current,
      endedAt,
      durationSec,
      samples: samples.current.slice(),
    }
    saveDemoSession(session)
    return session
  }, [])
}
