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
import { WATCH_HINT, WATCH_PULSE_TAG, pulseOrigin } from './watchStatus'
import { bpmText, pulseTag, signalText, useHeartRateSource } from './heartRate'
import { selectHeartRate } from '@/features/rppg/lib/heartRateSource'
import { useLivePulse } from './demoBits'
import { Morph } from './Morph'
import DotOrb from './orbs/DotOrb'
import PulseCanvas from './PulseCanvas'
import styles from './measureDemo.module.css'
import { fusedRows } from './fusedText'
import { levelShort } from './storedOverview'
import { formatElapsed, useElapsed } from './useElapsed'
import { useFaceTrack } from './useFaceTrack'
import { useLiveFusedState } from './useLiveFusedState'
import { useSessionLog } from './useSessionLog'
import { attachSessionExtras } from './sessionLog'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { useSteadyEmotion, type EmotionResponseMode } from './useSteadyEmotion'
import { useStoredOverview } from './useStoredOverview'
import { useStoredSession } from './useStoredSession'
import { useMeasureRecording } from './useMeasureRecording'
import { storageRowText } from './storageStatus'
import { loadConsent, saveConsent, type StorageConsent } from '@/shared/storage/consent'
import { useNudge } from '@/features/feedback/hooks/useNudge'
import { careSuggestions, type BreathingPlan } from '@/features/feedback/lib/careActions'
import { loadProfile } from '@/shared/storage/profile'
import BreathingGuide from './BreathingGuide'
import CareCard from './CareCard'

/**
 * 측정 화면 데모(분할 계기판). 검정 히어로에서 "측정 시작"을 누르면 온다.
 * 왼쪽은 카메라 프레임과 맥박 파형, 오른쪽은 BPM·오브·상태 행이다.
 * 감정·rPPG는 같은 카메라에서 얻고, 유효한 워치가 있으면 표시 심박으로 우선한다.
 * 워치가 없거나 끊기면 카메라 표시값을 쓰며 품질이 낮으면 참고값으로 알린다.
 * "오늘"과 "14일 기준선"은 이 기기에 저장된 실제 기록으로 계산한다.
 * 기록 저장에 동의했으면 측정하는 동안 1분 감정 요약을 이 기기에 저장한다(useMeasureRecording, 세션 연결).
 * 아직 고르지 않았으면 오른쪽 위에 저장 여부를 한 번 묻고 기억한다. 영상·심박 원시값은 저장하지 않는다.
 * 측정 종료를 누르면 남은 기록 저장을 마친 뒤 1초 표본(심박 포함)을 sessionStorage 로 넘기고 결과 화면으로 간다.
 * 휴식 알림(useNudge, 저장된 기록으로 판정)이 뜨면 아래에 쉬어 가기 제안을 띄운다. 위쪽 "숨 고르기"로 언제든 호흡 안내를 연다.
 * 호흡 안내를 하는 동안은 감정 기록을 저장하지 않는다(호흡이 표정·심박을 바꿔 평소 기록·기준선에 섞이지 않게).
 */

const HERO_HREF = DEMO_HOME_HREF
const RESULT_HREF = '/demo/result'
/** 얼굴 검출 주기. 저장 표본 간격의 기본값으로도 쓴다 */
const FACE_INTERVAL_MS = 250
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
  // 표본 콜백이 렌더 중 값이 아니라 최신 측정 여부를 읽게 한다
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])
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
  // 문자열 상수로 다시 만들어 React Compiler 가 아래 useCallback 의존값과 별개인 원시값으로 보게 한다
  const heartSource = selected.source === 'watch' ? 'watch' : selected.source === 'rppg' ? 'rppg' : null
  const sourceLabel = selected.source === 'watch' ? '워치'
    : selected.source === 'rppg' ? `카메라${rppgQuality === 'good' ? '' : ' · 참고값'}` : ''
  const watchPulse = useLivePulse(bpm ?? 0)
  // 워치가 대표 심박이면 파형·오브 박동도 워치 BPM 리듬을 따른다(워치를 기준으로 둔다).
  // 워치 리듬은 수신 BPM 으로 만든 주기 애니메이션이며 실측 파형이 아니다. 그 밖에는 rPPG 실측 파형을 쓴다.
  const pulseFrom = pulseOrigin(active, heartSource)
  const wavePulse = useCallback(() => pulseFrom === 'watch' ? watchPulse() : getPulse(),
    [pulseFrom, watchPulse, getPulse])
  const orbPulse = useCallback(() => !active ? 0
    : pulseFrom === 'watch' ? watchPulse() : rppg.rawBpm !== null ? getPulse() : 0,
  [active, pulseFrom, rppg.rawBpm, getPulse, watchPulse])
  // 기록 저장 동의. 아직 고르지 않았으면 null, 첫 렌더(서버와 맞춤) 동안은 undefined
  const [consent, setConsent] = useState<StorageConsent | null | undefined>(undefined)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(loadConsent())
  }, [])
  const decideConsent = (record: boolean) => {
    saveConsent(record)
    setConsent({ version: 1, record, decidedAt: new Date().toISOString() })
  }
  const recording = useMeasureRecording(active && consent?.record === true, { nominalIntervalMs: FACE_INTERVAL_MS })
  const [breathing, setBreathing] = useState<BreathingPlan | null>(null)
  // 이번 측정의 표정 평균(결과 화면의 상태별 제안용). 측정을 다시 시작하면 처음부터 모은다
  const faceSum = useRef({ happy: 0, calm: 0, sad: 0, angry: 0, n: 0 })
  useEffect(() => {
    if (active) faceSum.current = { happy: 0, calm: 0, sad: 0, angry: 0, n: 0 }
  }, [active])
  const pushSample = recording.push
  const onSample = useCallback((raw: EmotionResult | null) => {
    pushSample(raw)
    if (!raw || !activeRef.current) return
    const acc = faceSum.current
    acc.happy += raw.happy
    acc.calm += raw.calm
    acc.sad += raw.sad
    acc.angry += raw.angry
    acc.n += 1
  }, [pushSample])
  const face = useFaceTrack(videoRef, webcam === 'ready', {
    rotation,
    getFace,
    intervalMs: FACE_INTERVAL_MS,
    // 호흡 안내 중에는 저장·평균 모두 넘기지 않는다
    onSample: breathing ? undefined : onSample,
  })
  const nudge = useNudge()
  /** 위쪽 숨 고르기: 설문에서 고른 호흡 방법(받지 않기여도 직접 열면 순환 한숨 1분) */
  const openBreathing = () => {
    const plan = careSuggestions(loadProfile(), 'during').find((s) => s.breathing)?.breathing
    setBreathing(plan ?? { technique: 'sigh', durationSec: 60 })
  }
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
  // 표정(최근 1분 부정 표정)과 대표 심박(세션 첫 2분 대비 상승)을 결합한 지금 상태 (algorithm/stress/fusedStress)
  const fused = useLiveFusedState(active, bpm, active ? face.emotions : null)
  // Electron 에서만: 측정 상태(감정 비율·측정 중·프레임)를 메인 프로세스로 보내 최소화 위젯이 그린다. 웹에서는 아무 일도 하지 않는다.
  useDesktopMeasurementPublisher({
    active,
    emotions: active ? face.emotions : null,
    recordCount: recording.status?.saved ?? 0,
    videoEl,
    saveFailed: recording.status?.failed ?? false,
  })

  /** 측정 종료: 남은 1분 기록 저장을 마치고, 이번 측정 표본을 넘긴 뒤 결과 화면으로 간다. */
  const [ending, setEnding] = useState(false)
  const endMeasure = async () => {
    if (!active || ending) return
    setEnding(true)
    finishLog()
    const saved = await recording.stop()
    const acc = faceSum.current
    attachSessionExtras({
      sessionId: saved?.sessionId && saved.saved > 0 ? saved.sessionId : undefined,
      faceMean: acc.n > 0 ? { happy: acc.happy / acc.n, calm: acc.calm / acc.n, sad: acc.sad / acc.n, angry: acc.angry / acc.n } : undefined,
    })
    setActive(false)
    setEnding(false)
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
            <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={openBreathing}>
              숨 고르기
            </button>
            <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
              {theme === 'dark' ? '화이트' : '다크'}
            </button>
          </div>
          <button type="button" className={`${styles.cta} ${styles.focusable}`} onClick={() => (active ? void endMeasure() : setActive(true))}>
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
            <Skeleton loading={!ready && pulseFrom !== 'watch'} id="measure-wave" label="맥박 파형 준비 중">
              <div className={styles.waveBox} skullet-block="">
                <PulseCanvas getPulse={wavePulse} className={styles.wave} color={ink} />
                <span className={styles.frameTag}>{pulseFrom === 'watch' ? WATCH_PULSE_TAG : pulseTag(rppg)}</span>
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
            {consent === null && (
              <div className={styles.consentBox} role="region" aria-label="기록 저장 여부">
                <p className={styles.consentText}>
                  측정하는 동안 1분마다 감정 요약을 이 기기에 저장할까요? 리포트·상태 확인·휴식 알림이 이 기록을 씁니다. 영상과 얼굴 사진은 저장하지 않습니다.
                </p>
                <span className={styles.presets}>
                  <button type="button" className={`${styles.preset} ${styles.presetOn} ${styles.focusable}`} onClick={() => decideConsent(true)}>
                    저장
                  </button>
                  <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={() => decideConsent(false)}>
                    저장 안 함
                  </button>
                </span>
              </div>
            )}
            <div className={styles.rows}>
              <div className={styles.row}>
                <span className={styles.k}>측정</span>
                <CallSwitch on={active} onToggle={() => (active ? void endMeasure() : setActive(true))} />
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
                  ...fusedRows(active, fused, stored?.baseline ?? null, heartSource),
                  ['오늘', todayText],
                  ['14일 기준선', baselineText],
                  ['기록 저장', storageRowText(consent, active, recording.status)],
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
              <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={() => void endMeasure()}>
                측정 종료
              </button>
            </div>
          </div>
        </div>
        <p className={styles.legal}>{LEGAL}</p>
        {nudge.bannerOpen && !breathing && (
          <div className={styles.nudgeDock} role="status">
            <p className={styles.nudgeMessage}>{nudge.message}</p>
            <CareCard
              moment="during"
              level="high"
              title="지금 해볼 수 있는 것"
              onBreathe={(plan) => {
                nudge.close()
                setBreathing(plan)
              }}
            />
            <span className={styles.presets}>
              <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={nudge.close}>
                나중에
              </button>
              <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={nudge.muteToday}>
                오늘은 그만
              </button>
            </span>
          </div>
        )}
        {breathing && <BreathingGuide plan={breathing} onClose={() => setBreathing(null)} />}
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
