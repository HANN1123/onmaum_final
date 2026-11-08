import { useEffect, useRef, useState } from 'react'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import {
  liveFusedState,
  negativeShare,
  REF_WINDOW_SEC,
  type FusedSample,
  type LiveFusedState,
} from '@/features/algorithm/stress/fusedStress'

/**
 * 측정 중 1초마다 (경과 초, 대표 심박, 부정 표정 확률)을 쌓고 algorithm 의 liveFusedState 로
 * 지금의 표정 + 심박 결합 상태를 계산한다. 계산식은 algorithm 이 소유하고 이 훅은 표본만 모은다.
 * 측정을 새로 시작하면 표본과 기준 심박을 비운다. 표본은 메모리에만 두고 저장하지 않는다.
 */
export function useLiveFusedState(active: boolean, bpm: number | null, emotions: EmotionResult | null): LiveFusedState | null {
  const latest = useRef({ bpm, emotions })
  const samples = useRef<FusedSample[]>([])
  const [state, setState] = useState<LiveFusedState | null>(null)

  useEffect(() => {
    latest.current = { bpm, emotions }
  }, [bpm, emotions])

  useEffect(() => {
    if (!active) return
    const startedAt = Date.now()
    // 이전 측정의 상태는 첫 1초 표본에서 덮어쓴다(측정 종료 중에는 아래 return 이 null 을 돌려준다)
    samples.current = []
    const timer = setInterval(() => {
      const t = Math.round((Date.now() - startedAt) / 1000)
      const { bpm: b, emotions: e } = latest.current
      samples.current.push({ t, bpm: b, neg: e ? negativeShare(e) : null })
      // 기준 구간 표본은 계속 필요하므로 남기고, 그 뒤로는 최근 구간 계산에 필요한 만큼만 둔다
      if (samples.current.length > REF_WINDOW_SEC + 600) {
        const ref = samples.current.filter((p) => p.t < REF_WINDOW_SEC)
        samples.current = [...ref, ...samples.current.filter((p) => p.t >= REF_WINDOW_SEC).slice(-120)]
      }
      setState(liveFusedState(samples.current, t))
    }, 1000)
    return () => clearInterval(timer)
  }, [active])

  return active ? state : null
}
