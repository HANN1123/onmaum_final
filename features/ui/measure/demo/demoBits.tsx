'use client'

import { useCallback } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import styles from './measureDemo.module.css'
import { mixRgb, ORB_PALETTE, rgba } from './orbs/emotionPalette'

/** 결과·리포트 화면이 같이 쓰는 작은 조각들. */

/** 초 → 07:12. 상단 바는 측정 화면과 같은 00:07:12 를 쓴다. */
export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 감정 표시용 작은 색. 흰 바탕에서는 바닥색을 섞어 어둡게 한다.
 * 팔레트 검증에서 금빛·청록이 흰색과 1.6~1.8:1 로 낮게 나왔기 때문이다. 글자 라벨이 항상 함께 붙는다.
 */
export function swatchColor(emotion: Emotion, light: boolean): string {
  const p = ORB_PALETTE[emotion]
  return rgba(light ? mixRgb(p.base, p.deep, 0.45) : p.base, 1)
}

/** 정해진 BPM 으로 뛰는 합성 맥박. 정지 화면의 오브도 두근거리게 한다. */
export function usePulseAt(bpm: number): () => number {
  return useCallback(() => {
    const phase = ((performance.now() / 1000) * (bpm / 60)) % 1
    const systolic = Math.exp(-(((phase - 0.16) / 0.06) ** 2))
    const dicrotic = 0.32 * Math.exp(-(((phase - 0.44) / 0.1) ** 2))
    return Math.min(1, systolic + dicrotic)
  }, [bpm])
}

export function Stat({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statK}>{k}</span>
      <span className={styles.statV}>
        {v}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
    </div>
  )
}

export function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.k}>{k}</span>
      <span>{v}</span>
    </div>
  )
}
