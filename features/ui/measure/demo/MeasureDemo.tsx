'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Skeleton, SkeletonBox, SkulletProvider } from 'skullet/react'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { useWebcam } from '@/features/ui/landing/hero-demo/useWebcam'
import { useDesktopMeasurementPublisher } from '@/features/electron/renderer/useDesktopMeasurementPublisher'
import { LEGAL } from './demoCopy'
import { loadCameraRotation, nextCameraRotation, saveCameraRotation, type CameraRotation } from '@/shared/storage/cameraRotation'
import FaceLayer from './FaceLayer'
import { rotatedVideoStyle } from './rotationLayout'
import { useWatch } from './useWatch'
import { WATCH_HINT } from './watchStatus'
import { bpmText, pulseTag, signalText, useHeartRateSource } from './heartRate'
import { selectHeartRate } from '@/features/rppg/lib/heartRateSource'
import { useLivePulse } from './demoBits'
import { Morph } from './Morph'
import DotOrb from './orbs/DotOrb'
import PulseCanvas from './PulseCanvas'
import styles from './measureDemo.module.css'
import { levelShort } from './storedOverview'
import { formatElapsed, useElapsed } from './useElapsed'
import { useFaceTrack } from './useFaceTrack'
import { useSessionLog } from './useSessionLog'
import { useSteadyEmotion, type EmotionResponseMode } from './useSteadyEmotion'
import { useStoredOverview } from './useStoredOverview'
import { useStoredSession } from './useStoredSession'

/**
 * 측정 화면 데모(분할 계기판). 검정 히어로에서 "측정 시작"을 누르면 온다.
 * 왼쪽은 카메라 프레임과 맥박 파형, 오른쪽은 BPM·오브·상태 행이다.
 * 감정·rPPG는 같은 카메라에서 얻고, 유효한 워치가 있으면 표시 심박으로 우선한다.
 * 워치가 없거나 끊기면 카메라 표시값을 쓰며 품질이 낮으면 참고값으로 알린다.
 * "오늘"과 "14일 기준선"은 이 기기에 저장된 실제 기록으로 계산한다.
 * 측정 종료를 누르면 이번 측정 기록을 sessionStorage 로 넘기고 결과 화면으로 간다(저장 계층에는 저장하지 않는다).
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

export default function MeasureDemo() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // 데스크톱 위젯 발행이 프레임 수를 읽을 video 요소. ref 를 렌더 중에 읽지 않도록 상태로도 둔다
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el
    setVideoEl(el)
  }, [])
  const [active, setActive] = useState(true)
  // 카메라 회전(시계 방향). 웹캠을 세워 쓰거나 뒤집어 달았을 때 화면과 분석 입력을 함께 돌린다. 이 기기에만 저장한다
  const [rotation, setRotation] = useState<CameraRotation>(0)
  useEffect(() => {
    // localStorage 는 클라이언트에서만 — 첫 렌더는 0으로 서버와 맞추고, 그 뒤 저장된 값을 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRotation(loadCameraRotation())
  }, [])
  const rotateCamera = () => {
    const next = nextCameraRotation(rotation)
    setRotation(next)
    saveCameraRotation(next)
  }
  // 카메라 칸 크기와 영상 원본 크기로 돌린 영상의 칸 채움 스타일을 계산한다
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null)
  const [frameSize, setFrameSize] = useState({ cw: 0, ch: 0, vw: 0, vh: 0 })
  useEffect(() => {
    if (!frameEl || !videoEl) return
    const update = () =>
      setFrameSize({ cw: frameEl.clientWidth, ch: frameEl.clientHeight, vw: videoEl.videoWidth, vh: videoEl.videoHeight })
    const observer = new ResizeObserver(update)
    observer.observe(frameEl)
    videoEl.addEventListener('loadedmetadata', update)
    videoEl.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      videoEl.removeEventListener('loadedmetadata', update)
      videoEl.removeEventListener('resize', update)
    }
  }, [frameEl, videoEl])
  const videoStyle = rotatedVideoStyle(frameSize.cw, frameSize.ch, frameSize.vw, frameSize.vh, rotation) ?? undefined
  const [responseMode, setResponseMode] = useState<EmotionResponseMode>('demo')
  const [theme, toggleTheme] = useDemoTheme()
  const ink = theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)'
  const webcam = useWebcam(videoRef, true)
  // rPPG 엔진이 매 프레임 BlazeFace 로 찾은 얼굴 상자를 감정 분석도 같이 쓴다(엔진이 돌지 않을 때만 SSD)
  const { displayBpm: rppgBpm, quality: rppgQuality, getPulse, reading: rppg, getFace, getFaceRate } = useHeartRateSource(videoRef, webcam === 'ready' && active, rotation)
  const watch = useWatch(rppg.bpm)
  // 확인 횟수를 쌓지 않는 순수 선택이므로 최초 연결·재연결·재시작 모두 새 상태로 평가한다.
  const selected = selectHeartRate({ ...watch, rppgBpm, rppgQuality })
  const bpm = active ? selected.bpm : null
  const sourceLabel = selected.source === 'watch' ? '워치'
    : selected.source === 'rppg' ? `카메라${rppgQuality === 'good' ? '' : ' · 참고값'}` : ''
  const watchPulse = useLivePulse(bpm ?? 0)
  // 수신 BPM 기반 주기 애니메이션이며 실측 파형이 아니다. 실제 rPPG 파형이 있을 때는 그것을 쓴다.
  const orbPulse = useCallback(() => !active ? 0
    : rppg.rawBpm !== null ? getPulse() : selected.source === 'watch' ? watchPulse() : 0,
  [active, rppg.rawBpm, getPulse, selected.source, watchPulse])
  const face = useFaceTrack(videoRef, webcam === 'ready', { rotation, getFace })
  // 카메라와 얼굴 인식 모델이 모두 준비되기 전에는 값 대신 실제 모양의 뼈대를 보여준다(Skullet 시험 적용).
  const ready = webcam === 'ready' && face.modelsReady
  const elapsed = useElapsed(active)
  // 오브 색은 순간 감정이 아니라 안정된 감정을 따른다.
  const orbEmotion = useSteadyEmotion(active ? face.emotion : null, responseMode, 'calm', rotation)
  // 기록에는 얼굴을 찾은 순간의 감정만 남긴다. 못 찾은 순간을 마지막 색(기본 평온)으로 채우지 않는다.
  const finishLog = useSessionLog(active, bpm, active && face.emotion ? orbEmotion : null, rppgQuality, rppg.rawBpm,
    { latest: watch.latest, status: watch.status, rppgBpm })
  const lastSession = useStoredSession()
  const stored = useStoredOverview()
  // Electron 에서만: 측정 상태(감정 비율·측정 중·프레임)를 메인 프로세스로 보내 최소화 위젯이 그린다. 웹에서는 아무 일도 하지 않는다.
  // 이 데모 측정은 저장 계층에 저장하지 않으므로 기록 수는 0, 저장 실패는 없음으로 보낸다.
  useDesktopMeasurementPublisher({ active, emotions: active ? face.emotions : null, recordCount: 0, videoEl, saveFailed: false })

  /** 측정 종료: 기록을 넘기고 결과 화면으로 간다. */
  const endMeasure = () => {
    if (!active) return
    finishLog()
    setActive(false)
    router.push(RESULT_HREF)
  }

  // 심박 신호: rPPG 엔진의 상태와 SNR(품질 게이트 기준)
  const quality = webcam !== 'ready' ? '대기' : signalText(rppg)
  // 최근 10초 얼굴 검출률(엔진이 처리한 프레임 기준). 인식이 잘 되는지 숫자로 확인할 수 있게 함께 보인다
  const faceRate = getFaceRate()
  const faceRateText = faceRate === null ? '' : ` · 검출 ${Math.round(faceRate * 100)}%`
  const faceState = webcam !== 'ready' ? '카메라 대기' : `${face.box ? '얼굴 추적 중' : '얼굴 찾는 중'}${faceRateText}`
  const emotion = face.emotionLabel ?? '—'
  const elapsedText = formatElapsed(elapsed)
  const todayText =
    stored === null
      ? '읽는 중'
      : stored.today.scores
        ? `긍정 ${Math.round(stored.today.scores.positive)} · 스트레스 ${Math.round(stored.today.stress ?? stored.today.scores.stress)}`
        : '저장된 기록 없음'
  const baselineText =
    stored === null
      ? '읽는 중'
      : stored.today.level === null
        ? '오늘 기록 없음'
        : stored.baseline.mode === 'relative'
          ? levelShort(stored.today.level, stored.baseline)
          : `기록 3일 미만 · ${levelShort(stored.today.level, stored.baseline)}`

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
                지난 측정 결과
              </Link>
            )}
            <span className={`${styles.live} ${styles.mono}`}>
              {active && <span className={styles.liveDot} aria-hidden="true" />}
              <Morph>{`${active ? '측정 중' : '측정 종료'} ${elapsedText}`}</Morph>
            </span>
            <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
              {theme === 'dark' ? '화이트' : '다크'}
            </button>
          </div>
          <button type="button" className={`${styles.cta} ${styles.focusable}`} onClick={() => (active ? endMeasure() : setActive(true))}>
            {active ? '측정 종료' : '측정 시작'}
          </button>
        </nav>

        <div className={`${styles.body} ${styles.measureBody}`}>
          <div className={styles.left}>
            <div ref={setFrameEl} className={styles.frame}>
              <video ref={attachVideo} muted playsInline autoPlay style={videoStyle} />
              <FaceLayer box={active ? face.box : null} videoRef={videoRef} rotation={rotation} />
              <button
                type="button"
                className={`${styles.rotateBtn} ${styles.focusable}`}
                onClick={rotateCamera}
                aria-label={`카메라 화면 회전, 지금 ${rotation}도`}
                title="웹캠이 옆으로 누웠거나 뒤집혔을 때 눌러 바로 세웁니다"
              >
                ↻ {rotation}°
              </button>
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
                <span className={styles.frameTag}>{pulseTag(rppg)}</span>
              </div>
            </Skeleton>
          </div>

          <div className={styles.right}>
            <Skeleton loading={!ready && selected.source !== 'watch'} id="measure-head" label="심박 준비 중">
              <div className={styles.head}>
                <div className={styles.bpmRow}>
                  <Morph className={styles.bpm}>{bpmText(bpm)}</Morph>
                  <span className={styles.unit}>BPM</span>
                  {active && sourceLabel && <span className={styles.k}>{sourceLabel}</span>}
                </div>
                <span skullet-block="" style={{ display: 'block', borderRadius: '50%' }}>
                  <DotOrb getPulse={orbPulse} emotion={orbEmotion} bpm={bpm ?? undefined} scheme={theme} size={128} className={styles.measureOrb} />
                </span>
              </div>
            </Skeleton>
            <div className={styles.rows}>
              <div className={styles.row}>
                <span className={styles.k}>측정</span>
                <CallSwitch on={active} onToggle={() => (active ? endMeasure() : setActive(true))} />
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
                  ['측정 시간', elapsedText],
                  ['얼굴', faceState],
                  ['심박 신호', quality],
                  ['현재 감정', emotion],
                  ['오늘', todayText],
                  ['14일 기준선', baselineText],
                ]}
              />
            </Skeleton>
            {/* 워치 행은 카메라 준비용 뼈대(Skeleton) 밖에 둬서 카메라·모델이 늦거나 실패해도 연결할 수 있게 한다 */}
            <div className={`${styles.rows} ${styles.watchRows}`}>
              <div className={styles.row}>
                <span className={styles.k}>워치</span>
                <span className={styles.watchValue}>
                  <span role="status">{watch.text}</span>
                  {watch.action && (
                    <button
                      type="button"
                      className={`${styles.preset} ${styles.focusable}`}
                      onClick={watch.action === 'connect' ? watch.connect : watch.disconnect}
                      title={watch.action === 'connect' ? WATCH_HINT : undefined}
                    >
                      {watch.action === 'connect' ? '연결' : '끊기'}
                    </button>
                  )}
                </span>
              </div>
            </div>
            {/* 세로 배치에서는 위쪽 메뉴의 측정 종료와 같아서 숨긴다(measureEndBottom) */}
            <div className={styles.measureEndBottom} style={{ marginTop: 'auto' }}>
              <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={endMeasure}>
                측정 종료
              </button>
            </div>
          </div>
        </div>
        <p className={styles.legal}>{LEGAL}</p>
      </SkulletProvider>
    </section>
  )
}

/** 측정 시작/종료 스위치. 켜짐이 측정 중이다. */
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
          <Morph className={styles.rowValue}>{v}</Morph>
        </div>
      ))}
    </div>
  )
}
