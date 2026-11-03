import { useCallback, useEffect, useRef } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { saveDemoSession, type DemoSession, type TimelinePoint } from './sessionLog'

/**
 * 측정 중 1초마다 (경과 초, 심박, 감정)을 쌓는다. 심박이 없거나 얼굴을 못 찾은 순간은 null 로 남긴다.
 * 돌려주는 finish() 가 마지막 표본을 더해 기록을 sessionStorage 에 넣고 측정 한 번을 반환한다.
 * 최신 값은 ref 로 들고 있어 interval 콜백이 렌더와 무관하게 읽는다.
 */
export function useSessionLog(active: boolean, bpm: number | null, emotion: Emotion | null): () => DemoSession {
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
    const recorded = samples.current.slice()
    // 종료 순간을 마지막 표본으로 더한다. 1초 안에 끝내도 표본이 둘이 되어 결과 화면이 이 측정을 보여준다.
    if (recorded[recorded.length - 1]?.t !== durationSec) {
      recorded.push({ t: durationSec, bpm: latest.current.bpm, emotion: latest.current.emotion })
    }
    const session: DemoSession = { startedAt: startedAt.current, endedAt, durationSec, samples: recorded }
    saveDemoSession(session)
    return session
  }, [])
}
