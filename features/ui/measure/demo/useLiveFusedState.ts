import { useEffect, useRef, useState } from 'react'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import {
  liveFusedState,
  negativeShare,
  REF_WINDOW_SEC,
  type FusedSample,
  type LiveFusedState,
} from '@/features/algorithm/stress/fusedStress'
import type { HeartRateOrigin } from '@/features/rppg/lib/heartRateSource'
import type { RppgQuality } from '@/features/rppg/engine/rppgGate'

/**
 * 결합 판정에 넣을 심박. 화면의 큰 숫자는 참고값(움직임·신호 약함·안정화 중)도 보여주지만,
 * 결합 규칙(docs/architecture/STRESS_FUSION_RULE.md 12절)은 품질 기준을 통과한 심박만 쓴다.
 * 유효한 워치 값이거나 품질이 good 인 카메라 값만 통과시키고, 나머지는 심박 없음(null)으로 넘긴다.
 */
export function fusionBpm(selected: { bpm: number | null; source: HeartRateOrigin | null; rppgQuality: RppgQuality | null }): number | null {
  if (selected.bpm === null) return null
  if (selected.source === 'watch') return selected.bpm
  return selected.source === 'rppg' && selected.rppgQuality === 'good' ? selected.bpm : null
}

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
