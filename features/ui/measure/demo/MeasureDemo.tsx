'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { useWebcam } from '@/features/ui/landing/hero-demo/useWebcam'
import FaceLayer from './FaceLayer'
import DotOrb from './orbs/DotOrb'
import PulseCanvas from './PulseCanvas'
import styles from './measureDemo.module.css'
import { useFaceTrack } from './useFaceTrack'
import { formatElapsed, useSimulatedVitals } from './useSimulatedVitals'
import { useSteadyEmotion, type EmotionResponseMode } from './useSteadyEmotion'
import { MEASURE_DEMO_VARIANTS, type MeasureDemoVariant } from './variants'

/**
 * 측정 화면 시안 A·B·C. 검정 히어로에서 "측정 시작"을 누르면 온다.
 * 카메라와 얼굴 추적·감정은 실제 값이고, 맥박 파형과 BPM 은 시연용 모의 신호다.
 * 오늘 지수와 기준선 문구는 표본이다. 아무것도 저장하지 않는다.
 */

const HERO_HREF = '/demo/hero-dark'
const SAMPLE_TODAY = { positive: 41, stress: 23 }
const SAMPLE_VERDICT = '평소보다 가벼움'
const LEGAL = '기록은 이 기기 안에만 남습니다 · 의료 진단이 아니라 자기 인식을 돕는 도구입니다 · 도움이 필요하면 1577-0199 · 109'
/** 시연용 모의 심박 목표값. rPPG 가 붙으면 이 줄은 사라진다. */
const BPM_PRESETS = [60, 75, 95, 120] as const

interface Props {
  variant: MeasureDemoVariant
}

export default function MeasureDemo({ variant }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState(true)
  const [targetBpm, setTargetBpm] = useState<number>(75)
  const [responseMode, setResponseMode] = useState<EmotionResponseMode>('demo')
  const [theme, toggleTheme] = useDemoTheme()
  const ink = theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)'
  const inkSoft = theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.45)'
  const webcam = useWebcam(videoRef, true)
  const face = useFaceTrack(videoRef, webcam === 'ready')
  const { bpm, elapsed, getPulse } = useSimulatedVitals(active, targetBpm)
  // 오브 색은 순간 감정이 아니라 안정된 감정을 따른다.
  const orbEmotion = useSteadyEmotion(active ? face.emotion : null, responseMode)

  const quality = webcam !== 'ready' ? '대기' : face.box ? '양호' : '낮음'
  const faceState = webcam !== 'ready' ? '카메라 대기' : face.box ? '얼굴 추적 중' : '얼굴 찾는 중'
  const emotion = face.emotionLabel ?? '—'
  const elapsedText = formatElapsed(elapsed)

  const video = <video ref={videoRef} muted playsInline autoPlay />
  const faceLayer = <FaceLayer box={active ? face.box : null} videoRef={videoRef} />

  const nav = (
    <nav className={styles.nav}>
      <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
        ONMAUM
      </Link>
      <div className={styles.navMid}>
        <div className={`${styles.switcher} ${styles.mono}`} aria-label="시안 선택">
          <span className={styles.dimmer}>시안</span>
          {MEASURE_DEMO_VARIANTS.map((v) => (
            <Link key={v} href={`/demo/measure/${v}`} className={v === variant ? styles.current : undefined}>
              {v.toUpperCase()}
            </Link>
          ))}
        </div>
        <span className={`${styles.live} ${styles.mono}`}>
          {active && <span className={styles.liveDot} aria-hidden="true" />}
          {active ? '통화 중' : '통화 종료'} {elapsedText}
        </span>
        <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
          {theme === 'dark' ? '화이트' : '다크'}
        </button>
      </div>
      <button type="button" className={`${styles.cta} ${styles.focusable}`} onClick={() => setActive((v) => !v)}>
        {active ? '전화 종료' : '전화 시작'}
      </button>
    </nav>
  )

  const rows = (
    <Rows
      rows={[
        ['신호 품질', quality],
        ['현재 감정', emotion],
        ['오늘', `긍정 ${SAMPLE_TODAY.positive} · 스트레스 ${SAMPLE_TODAY.stress}`],
        ['14일 기준선', SAMPLE_VERDICT],
      ]}
    />
  )

  const ended = (
    <Ended
      elapsedText={elapsedText}
      bpm={bpm}
      emotion={emotion}
      onRestart={() => setActive(true)}
    />
  )

  const shellClass = `${sora.variable} ${jetbrainsMono.variable} ${styles.shell}`
  const shellProps = { className: shellClass, 'data-theme': theme } as const

  if (variant === 'a') {
    return (
      <section {...shellProps}>
        <div className={styles.media}>
          {video}
          {faceLayer}
        </div>
        <div className={styles.scrim} aria-hidden="true" />
        {nav}
        <div className={styles.aBody}>
          <div className={styles.aPanel}>
            {active ? (
              <>
                <span className={styles.chip}>[ 측정 중 · {faceState} ]</span>
                <div className={styles.bpmRow}>
                  <span className={styles.bpm}>{bpm}</span>
                  <span className={styles.unit}>BPM</span>
                </div>
                {rows}
              </>
            ) : (
              ended
            )}
          </div>
        </div>
        <footer className={styles.aFooter}>
          <PulseCanvas getPulse={getPulse} className={`${styles.wave} ${styles.aWave}`} color={ink} />
          <p className={styles.legal}>{LEGAL}</p>
        </footer>
      </section>
    )
  }

  if (variant === 'b') {
    return (
      <section {...shellProps}>
        {nav}
        <div className={styles.bBody}>
          <div className={styles.bLeft}>
            <div className={styles.frame}>
              {video}
              {faceLayer}
              <span className={styles.frameTag}>카메라 · {faceState}</span>
            </div>
            <div className={styles.bWaveBox}>
              <PulseCanvas getPulse={getPulse} className={styles.wave} color={ink} />
              <span className={styles.frameTag}>맥박 파형 · 모의 신호</span>
            </div>
          </div>
          <div className={styles.bRight}>
            {active ? (
              <>
                <div className={styles.bHead}>
                  <div className={styles.bpmRow}>
                    <span className={styles.bpm}>{bpm}</span>
                    <span className={styles.unit}>BPM</span>
                  </div>
                  <DotOrb getPulse={getPulse} emotion={orbEmotion} bpm={bpm} scheme={theme} size={128} />
                </div>
                <div className={styles.rows}>
                  <div className={styles.row}>
                    <span className={styles.k}>통화</span>
                    <CallSwitch on={active} onToggle={() => setActive((v) => !v)} />
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
                  <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={() => setActive(false)}>
                    전화 종료
                  </button>
                </div>
              </>
            ) : (
              ended
            )}
          </div>
        </div>
        <p className={styles.legal}>{LEGAL}</p>
      </section>
    )
  }

  return (
    <section {...shellProps}>
      {nav}
      <div className={styles.cBody}>
        <div className={`${styles.frame} ${styles.cThumb}`}>
          {video}
          {faceLayer}
          <span className={styles.frameTag}>{faceState}</span>
        </div>
        {active ? (
          <>
            <DotOrb getPulse={getPulse} emotion={orbEmotion} bpm={bpm} scheme={theme} size={300} />
            <div className={styles.bpmRow}>
              <span className={styles.bpm}>{bpm}</span>
              <span className={styles.unit}>BPM</span>
            </div>
            <p className={styles.cEmotion}>{face.emotionLabel ?? '얼굴을 찾는 중'}</p>
            <div className={`${styles.cMeta} ${styles.mono} ${styles.dim}`}>
              <span>신호 품질 {quality}</span>
              <span>
                오늘 긍정 {SAMPLE_TODAY.positive} · 스트레스 {SAMPLE_TODAY.stress}
              </span>
              <span>{SAMPLE_VERDICT}</span>
            </div>
          </>
        ) : (
          <div style={{ width: 'min(90vw, 520px)' }}>{ended}</div>
        )}
      </div>
      <footer>
        <PulseCanvas getPulse={getPulse} className={`${styles.wave} ${styles.cWave}`} color={inkSoft} />
        <p className={styles.legal}>{LEGAL}</p>
      </footer>
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

function Ended({
  elapsedText,
  bpm,
  emotion,
  onRestart,
}: {
  elapsedText: string
  bpm: number
  emotion: string
  onRestart: () => void
}) {
  return (
    <div className={styles.ended}>
      <span className={styles.chip}>[ 통화 종료 ]</span>
      <p className={styles.endedTitle}>기록했습니다</p>
      <Rows
        rows={[
          ['통화 시간', elapsedText],
          ['평균 심박수', `${bpm} BPM`],
          ['마지막 감정', emotion],
          ['오늘', `긍정 ${SAMPLE_TODAY.positive} · 스트레스 ${SAMPLE_TODAY.stress}`],
        ]}
      />
      <div className={styles.actions}>
        <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={onRestart}>
          다시 시작
        </button>
        <Link href="/stats" className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
          리포트 보기
        </Link>
      </div>
    </div>
  )
}
