'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { useWebcam } from '@/features/ui/landing/hero-demo/useWebcam'
import { LEGAL, SAMPLE_TODAY, SAMPLE_VERDICT } from './demoCopy'
import FaceLayer from './FaceLayer'
import DotOrb from './orbs/DotOrb'
import PulseCanvas from './PulseCanvas'
import styles from './measureDemo.module.css'
import { useFaceTrack } from './useFaceTrack'
import { useSessionLog } from './useSessionLog'
import { formatElapsed, useSimulatedVitals } from './useSimulatedVitals'
import { useSteadyEmotion, type EmotionResponseMode } from './useSteadyEmotion'
import { useStoredSession } from './useStoredSession'

/**
 * 측정 화면 데모(분할 계기판). 검정 히어로에서 "측정 시작"을 누르면 온다.
 * 왼쪽은 카메라 프레임과 맥박 파형, 오른쪽은 BPM·오브·상태 행이다.
 * 카메라와 얼굴 추적·감정은 실제 값이고, 맥박 파형과 BPM 은 시연용 모의 신호다.
 * 오늘 지수와 기준선 문구는 표본이다. 전화 종료를 누르면 통화 기록을 sessionStorage 로 넘기고 결과 화면으로 간다.
 */

const HERO_HREF = '/demo/hero-dark'
const RESULT_HREF = '/demo/result'
/** 시연용 모의 심박 목표값. rPPG 가 붙으면 이 줄은 사라진다. */
const BPM_PRESETS = [60, 75, 95, 120] as const

export default function MeasureDemo() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState(true)
  const [targetBpm, setTargetBpm] = useState<number>(75)
  const [responseMode, setResponseMode] = useState<EmotionResponseMode>('demo')
  const [theme, toggleTheme] = useDemoTheme()
  const ink = theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)'
  const webcam = useWebcam(videoRef, true)
  const face = useFaceTrack(videoRef, webcam === 'ready')
  const { bpm, elapsed, getPulse } = useSimulatedVitals(active, targetBpm)
  // 오브 색은 순간 감정이 아니라 안정된 감정을 따른다.
  const orbEmotion = useSteadyEmotion(active ? face.emotion : null, responseMode)
  const finishLog = useSessionLog(active, bpm, orbEmotion)
  const lastSession = useStoredSession()

  /** 통화 종료: 기록을 넘기고 결과 화면으로 간다. */
  const endCall = () => {
    if (!active) return
    finishLog()
    setActive(false)
    router.push(RESULT_HREF)
  }

  const quality = webcam !== 'ready' ? '대기' : face.box ? '양호' : '낮음'
  const faceState = webcam !== 'ready' ? '카메라 대기' : face.box ? '얼굴 추적 중' : '얼굴 찾는 중'
  const emotion = face.emotionLabel ?? '—'
  const elapsedText = formatElapsed(elapsed)

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell}`} data-theme={theme}>
      <nav className={styles.nav}>
        <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          {lastSession && (
            <Link href={RESULT_HREF} className={`${styles.navLink} ${styles.focusable}`}>
              지난 통화 결과
            </Link>
          )}
          <span className={`${styles.live} ${styles.mono}`}>
            {active && <span className={styles.liveDot} aria-hidden="true" />}
            {active ? '통화 중' : '통화 종료'} {elapsedText}
          </span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <button type="button" className={`${styles.cta} ${styles.focusable}`} onClick={() => (active ? endCall() : setActive(true))}>
          {active ? '전화 종료' : '전화 시작'}
        </button>
      </nav>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.frame}>
            <video ref={videoRef} muted playsInline autoPlay />
            <FaceLayer box={active ? face.box : null} videoRef={videoRef} />
            <span className={styles.frameTag}>카메라 · {faceState}</span>
          </div>
          <div className={styles.waveBox}>
            <PulseCanvas getPulse={getPulse} className={styles.wave} color={ink} />
            <span className={styles.frameTag}>맥박 파형 · 모의 신호</span>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.head}>
            <div className={styles.bpmRow}>
              <span className={styles.bpm}>{bpm}</span>
              <span className={styles.unit}>BPM</span>
            </div>
            <DotOrb getPulse={getPulse} emotion={orbEmotion} bpm={bpm} scheme={theme} size={128} />
          </div>
          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.k}>통화</span>
              <CallSwitch on={active} onToggle={() => (active ? endCall() : setActive(true))} />
            </div>
            <div className={styles.row}>
              <span className={styles.k}>모의 심박</span>
              <span className={styles.presets}>
                {BPM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.preset} ${styles.focusable} ${preset === targetBpm ? styles.presetOn : ''}`}
                    onClick={() => setTargetBpm(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.k}>색 반응</span>
              <span className={styles.presets}>
                <button
                  type="button"
                  className={`${styles.preset} ${styles.focusable} ${responseMode === 'demo' ? styles.presetOn : ''}`}
                  onClick={() => setResponseMode('demo')}
                >
                  시연
                </button>
                <button
                  type="button"
                  className={`${styles.preset} ${styles.focusable} ${responseMode === 'daily' ? styles.presetOn : ''}`}
                  onClick={() => setResponseMode('daily')}
                >
                  사용
                </button>
              </span>
            </div>
          </div>
          <Rows
            rows={[
              ['통화 시간', elapsedText],
              ['얼굴', faceState],
              ['신호 품질', quality],
              ['현재 감정', emotion],
              ['오늘', `긍정 ${SAMPLE_TODAY.positive} · 스트레스 ${SAMPLE_TODAY.stress}`],
              ['14일 기준선', SAMPLE_VERDICT],
            ]}
          />
          <div style={{ marginTop: 'auto' }}>
            <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={endCall}>
              전화 종료
            </button>
          </div>
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

/** 전화 시작/종료 스위치. 켜짐이 측정 중이다. */
function CallSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`${styles.switch} ${styles.focusable} ${on ? styles.switchOn : ''}`}
      onClick={onToggle}
    >
      <span className={styles.switchTrack} aria-hidden="true">
        <span className={styles.switchKnob} />
      </span>
      <span>{on ? '측정 중' : '대기'}</span>
    </button>
  )
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <div className={styles.rows}>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.row}>
          <span className={styles.k}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  )
}
