'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { EMOTION_LABELS, EMOTION_ORDER, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { useWebcam } from '@/features/ui/landing/hero-demo/useWebcam'
import FaceLayer from './FaceLayer'
import styles from './measureDemo.module.css'
import DotOrb from './orbs/DotOrb'
import { ORB_PALETTE, rgba } from './orbs/emotionPalette'
import ShaderOrb from './orbs/ShaderOrb'
import { useFaceTrack } from './useFaceTrack'
import { useSimulatedVitals } from './useSimulatedVitals'

/**
 * 오브 후보 비교. 같은 맥박으로 움직이고, 감정에 따라 색이 바뀐다.
 * 감정은 카메라가 읽은 값을 따르고, 버튼을 누르면 그 감정으로 고정해 볼 수 있다.
 */
export default function OrbLab() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const webcam = useWebcam(videoRef, true)
  const face = useFaceTrack(videoRef, webcam === 'ready')
  const { bpm, getPulse } = useSimulatedVitals(true)
  const [manual, setManual] = useState<Emotion | null>(null)
  const [theme, toggleTheme] = useDemoTheme()
  const emotion: Emotion = manual ?? face.emotion ?? 'calm'
  const source = manual ? '고정' : face.emotion ? '카메라' : '기본'

  const candidates = [
    { key: '3', name: '점 구체', Orb: DotOrb },
    { key: '4', name: '오로라 구', Orb: ShaderOrb },
  ] as const

  const chipButton = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(var(--text-rgb), 0.18)' : 'rgba(var(--text-rgb), 0.06)',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    border: 0,
    cursor: 'pointer',
  })

  return (
    <section
      className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell}`}
      data-theme={theme}
      style={{ gridTemplateRows: 'auto 1fr' }}
    >
      <nav className={styles.nav}>
        <Link href="/demo/measure" className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <span className={`${styles.mono} ${styles.dim}`}>
          오브 후보 · {bpm} BPM · 감정 <span style={{ color: rgba(ORB_PALETTE[emotion].base, 1) }}>{EMOTION_LABELS[emotion]}</span> ({source})
        </span>
        <span style={{ display: 'inline-flex', gap: 24, alignItems: 'center' }}>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
          <Link href="/demo/measure" className={`${styles.cta} ${styles.focusable}`}>
            시안 B로
          </Link>
        </span>
      </nav>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(20px, 3vw, 40px)',
          padding: '0 var(--gutter) 40px',
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {EMOTION_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.chip} ${styles.focusable}`}
              style={chipButton(manual === key)}
              onClick={() => setManual(key)}
            >
              {EMOTION_LABELS[key]}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.chip} ${styles.focusable}`}
            style={chipButton(manual === null)}
            onClick={() => setManual(null)}
          >
            카메라 따라가기
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', gap: 'clamp(24px, 5vw, 96px)' }}>
          {candidates.map(({ key, name, Orb }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <span className={styles.chip}>[ {key} · {name} ]</span>
              <Orb getPulse={getPulse} emotion={emotion} scheme={theme} size={300} />
              <Orb getPulse={getPulse} emotion={emotion} scheme={theme} size={110} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <span className={styles.chip}>[ 카메라 · {face.emotionLabel ?? '얼굴 찾는 중'} ]</span>
            <div className={styles.frame} style={{ width: 240, aspectRatio: '16 / 9' }}>
              <video ref={videoRef} muted playsInline autoPlay />
              <FaceLayer box={face.box} videoRef={videoRef} label={face.emotionLabel ?? '얼굴 추적 중'} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
