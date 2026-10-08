'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getDominantEmotion, type EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { EMOTION_SHADES } from '@/features/ui/orb/lib/orbColor'
import { motionFor } from '@/features/ui/orb/lib/orbMotion'
import { opacityFromCount } from '@/features/ui/orb/lib/orbStages'
import { EMOTION_CAPTIONS, pickCaption } from '@/features/ui/orb/lib/orbCaption'
import styles from './EmotionOrb.module.css'

interface Props {
  /** 현재 감정 분포 (오브 색·움직임의 근거) */
  emotions: EmotionResult
  /** 누적 기록 개수 (투명→자기 색 성장) */
  recordCount: number
  /** 오브 지름(px) */
  size?: number
  /** 한 줄 카피 표시 여부 */
  showCaption?: boolean
  /** 카피 색 톤 — 라이트 배경 'dark'(기본), 다크 배경 'light' */
  captionTone?: 'dark' | 'light'
  className?: string
}

/**
 * 감정 오브 — 엔진(orbColor/orbMotion/orbStages/orbCaption)을 소비하는
 * "단색 심도(light→mid→dark)" 구체 시각 컴포넌트.
 */
export default function EmotionOrb({
  emotions,
  recordCount,
  size = 160,
  showCaption = true,
  captionTone = 'dark',
  className,
}: Props) {
  const dominant = getDominantEmotion(emotions)
  const shade = EMOTION_SHADES[dominant]
  const motion = motionFor(dominant)
  const opacity = opacityFromCount(recordCount)
  // SSR은 결정적 첫 변형으로(hydration mismatch 방지), 마운트 후 클라이언트에서만 랜덤 추첨.
  // dominant이 바뀔 때마다 새 카피를 뽑아 지루함 방지.
  const [caption, setCaption] = useState<string>(() => EMOTION_CAPTIONS[dominant][0])
  useEffect(() => {
    // 클라이언트 전용 랜덤 추첨 — hydration mismatch 방지를 위한 의도적 setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaption(pickCaption(dominant))
  }, [dominant])

  const orbStyle = {
    width: size,
    height: size,
    opacity,
    '--c1': shade.c1,
    '--c2': shade.c2,
    '--c3': shade.c3,
    '--glow': shade.glow,
    '--shadow': shade.shadow,
    '--dur': `${motion.breathPeriodMs}ms`,
    '--amp': motion.breathAmp,
    '--floaty': `${motion.floatY * size}px`,
  } as CSSProperties & Record<string, string | number>

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div className={styles.orbBox} style={orbStyle}>
        <div className={styles.glow} />
        <div className={styles.orb} />
      </div>
      {showCaption && (
        <p
          className={[styles.caption, captionTone === 'light' ? styles.captionLight : '']
            .filter(Boolean)
            .join(' ')}
        >
          {caption}
        </p>
      )}
    </div>
  )
}
