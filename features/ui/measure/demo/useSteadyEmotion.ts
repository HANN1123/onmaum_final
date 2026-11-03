import { useEffect, useRef, useState } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

export type EmotionResponseMode = 'demo' | 'daily'

/** 시연은 빠르게, 실제 사용은 느리게. 단위는 ms. */
export const EMOTION_RESPONSE: Record<EmotionResponseMode, { dwell: number; hold: number }> = {
  demo: { dwell: 1500, hold: 5000 },
  daily: { dwell: 5000, hold: 30000 },
}

/**
 * 카메라가 읽은 순간 감정을 그대로 쓰지 않고, 오브 색에 쓸 "안정된 감정"을 만든다.
 * - 새 감정이 dwell 동안 계속 우세해야 후보가 된다(순간 오탐 제거).
 * - 한번 바뀌면 hold 동안은 지킨다(색이 쉴 새 없이 흔들리지 않게).
 * 얼굴을 못 찾으면(null) 마지막 색을 유지한다.
 */
/**
 * resetKey 가 바뀌면(예: 카메라 회전) 후보와 유지 시간을 처음부터 센다. 이전 방향의 후보가 새 방향 값과 섞이지 않게 하고,
 * 새 방향에서 안정된 감정이 나오면 유지 시간(hold)을 기다리지 않고 바로 바꾼다. 오브 색은 끊기지 않게 마지막 값을 유지한다.
 */
export function useSteadyEmotion(
  raw: Emotion | null,
  mode: EmotionResponseMode,
  initial: Emotion = 'calm',
  resetKey: unknown = null,
): Emotion {
  const [steady, setSteady] = useState<Emotion>(initial)
  const candidateRef = useRef<{ emotion: Emotion; since: number } | null>(null)
  const changedAtRef = useRef(0)
  const steadyRef = useRef(initial)

  useEffect(() => {
    steadyRef.current = steady
  }, [steady])

  useEffect(() => {
    candidateRef.current = null
    changedAtRef.current = 0
  }, [resetKey])

  useEffect(() => {
    const { dwell, hold } = EMOTION_RESPONSE[mode]
    const timer = setInterval(() => {
      const now = Date.now()
      if (!raw || raw === steadyRef.current) {
        candidateRef.current = null
        return
      }
      if (!candidateRef.current || candidateRef.current.emotion !== raw) {
        candidateRef.current = { emotion: raw, since: now }
        return
      }
      const persisted = now - candidateRef.current.since >= dwell
      const heldEnough = now - changedAtRef.current >= hold
      if (persisted && heldEnough) {
        changedAtRef.current = now
        candidateRef.current = null
        setSteady(raw)
      }
    }, 250)
    return () => clearInterval(timer)
  }, [raw, mode])

  return steady
}
