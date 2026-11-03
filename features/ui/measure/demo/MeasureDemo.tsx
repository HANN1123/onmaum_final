'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Skeleton, SkeletonBox, SkulletProvider } from 'skullet/react'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { useWebcam } from '@/features/ui/landing/hero-demo/useWebcam'
import { LEGAL, SAMPLE_TODAY, SAMPLE_VERDICT } from './demoCopy'
import FaceLayer from './FaceLayer'
import { Morph } from './Morph'
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

const HERO_HREF = DEMO_HOME_HREF
const RESULT_HREF = '/demo/result'
/**
 * 준비 중 뼈대(Skullet) 색. 화면 토큰과 같은 결: 검정 바탕엔 흰 잉크를, 흰 바탕엔 검정 잉크를 옅게.
 * 모서리는 각지게, 글자 막대는 대문자 높이에서 기준선까지만 그려 실제 글자 덩어리와 맞춘다.
 */
const SKULLET_THEME = {
  light: { base: 'rgba(0, 0, 0, 0.06)', highlight: 'rgba(0, 0, 0, 0.12)' },
  dark: { base: 'rgba(255, 255, 255, 0.07)', highlight: 'rgba(255, 255, 255, 0.15)' },
  radius: '0px',
  animation: 'shimmer',
  speed: 'slow',
  text: { top: 'cap-height', bottom: 'baseline' },
} as const
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
  // 카메라와 얼굴 인식 모델이 모두 준비되기 전에는 값 대신 실제 모양의 뼈대를 보여준다(Skullet 시험 적용).
  const ready = webcam === 'ready' && face.modelsReady
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
      <SkulletProvider mode={theme} theme={SKULLET_THEME} reveal="smart">
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
              <Morph>{`${active ? '통화 중' : '통화 종료'} ${elapsedText}`}</Morph>
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
              <span className={styles.frameTag}>
                <Morph>{`카메라 · ${faceState}`}</Morph>
              </span>
              {/*
                카메라 칸은 Skeleton 으로 감싸지 않는다. 준비가 끝나는 순간 안쪽을 새로 그려 video 요소가 바뀌고
                카메라 스트림이 끊기기 때문이다. 대신 같은 반짝임의 뼈대 상자를 위에 덮었다가 서서히 걷는다.
              */}
              <SkeletonBox
                width="100%"
                height="100%"
                radius={0}
                className={styles.frameSkeleton}
                style={{ opacity: ready ? 0 : 1 }}
              />
            </div>
            <Skeleton loading={!ready} id="measure-wave" label="맥박 파형 준비 중">
              <div className={styles.waveBox} skullet-block="">
                <PulseCanvas getPulse={getPulse} className={styles.wave} color={ink} />
                <span className={styles.frameTag}>맥박 파형 · 모의 신호</span>
              </div>
            </Skeleton>
          </div>

          <div className={styles.right}>
            <Skeleton loading={!ready} id="measure-head" label="심박 준비 중">
              <div className={styles.head}>
                <div className={styles.bpmRow}>
                  <Morph className={styles.bpm}>{String(bpm)}</Morph>
                  <span className={styles.unit}>BPM</span>
                </div>
                <span skullet-block="" style={{ display: 'block', borderRadius: '50%' }}>
                  <DotOrb getPulse={getPulse} emotion={orbEmotion} bpm={bpm} scheme={theme} size={128} />
                </span>
              </div>
            </Skeleton>
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
            <Skeleton loading={!ready} id="measure-status" label="측정 상태 준비 중">
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
            </Skeleton>
            <div style={{ marginTop: 'auto' }}>
              <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={endCall}>
                전화 종료
              </button>
            </div>
          </div>
        </div>
        <p className={styles.legal}>{LEGAL}</p>
      </SkulletProvider>
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
          <Morph>{v}</Morph>
        </div>
      ))}
    </div>
  )
}
