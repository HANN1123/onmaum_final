'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Skeleton, SkeletonBox, SkulletProvider } from 'skullet/react'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { useWebcam } from '@/features/ui/landing/hero-demo/useWebcam'
import { useDesktopMeasurementPublisher } from '@/features/electron/renderer/useDesktopMeasurementPublisher'
import { LEGAL } from './demoCopy'
import { loadCameraRotation, nextCameraRotation, saveCameraRotation, type CameraRotation } from '@/shared/storage/cameraRotation'
import FaceLayer from './FaceLayer'
import NavMenu, { type NavMenuItem } from './NavMenu'
import { MENU_ICON, themeMenuItem } from './menuItems'
import { rotatedSize, rotatedVideoStyle } from './rotationLayout'
import { useWatch } from './useWatch'
import { WATCH_HINT, pulseOrigin } from './watchStatus'
import { bpmText, useHeartRateSource } from './heartRate'
import { RPPG_STATUS_TEXT, type RppgReading } from '@/features/rppg/engine/rppgGate'
import { selectHeartRate } from '@/features/rppg/lib/heartRateSource'
import { useLivePulse } from './demoBits'
import { Morph } from './Morph'
import DotOrb from './orbs/DotOrb'
import PulseCanvas from './PulseCanvas'
import styles from './measureDemo.module.css'
import { liveStressLevel, stressLevelText } from './fusedText'
import { StressBar } from './StressGauge'
import EmotionFace from './EmotionFace'
import { faceRateText, heartSourceText, recordStateText, signalQualityText } from './monitorText'
import { STRESS_BEAT_PER_MIN, STRESS_PALETTE } from './orbs/stressPalette'
import { formatElapsed, useElapsed } from './useElapsed'
import { useFaceTrack } from './useFaceTrack'
import { fusionBpm, useLiveFusedState } from './useLiveFusedState'
import { useSessionLog } from './useSessionLog'
import { attachSessionExtras } from './sessionLog'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { useSteadyEmotion } from './useSteadyEmotion'
import { useStoredOverview } from './useStoredOverview'
import { useStoredSession } from './useStoredSession'
import { useMeasureRecording } from './useMeasureRecording'
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
 * 워치가 없거나 끊기면 카메라 표시값을 쓴다(화면에 참고값 표시는 하지 않는다. 결합 판정은 품질 기준을 통과한 값만 쓴다).
 * 워치가 대표 심박인 동안에는 카메라 파형 칸 아래에 워치 리듬 칸이 하나 더 생긴다(워치 표시는 연두색).
 * 측정 시작·종료는 오른쪽 아래 버튼 하나로 한다.
 * 아래 "모니터링 Info"에는 측정 시간·심박 신호 품질·얼굴 검출률·심박 측정 방식(워치 연결 버튼)·기록 여부만 둔다.
 * 그 바로 아래 "기록 저장" 버튼을 누르면 측정하는 동안 1분 감정 요약을 이 기기에 저장한다(useMeasureRecording, 세션 연결).
 * 다시 누르면(저장 멈춤) 저장을 멈춘다. 고른 값은 기억한다. 영상·심박 원시값은 저장하지 않는다.
 * 저장 여부를 아직 고르지 않았으면 처음 한 번 버튼 위에 묻는 칸을 띄운다.
 * 위쪽의 지난 측정 결과·숨 고르기·화면 색 전환은 "메뉴" 버튼을 눌러 펼친다.
 * 측정 종료를 누르면 남은 기록 저장을 마친 뒤 1초 표본(심박 포함)을 sessionStorage 로 넘기고 결과 화면으로 간다.
 * 휴식 알림(useNudge, 저장된 기록으로 판정)이 뜨면 아래에 쉬어 가기 제안을 띄운다. 메뉴의 "숨 고르기"로 언제든 호흡 안내를 연다.
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
  // 감정 상태 옆 표정 그림(팀 디자인 비교용). 메뉴에서 선 그림·원본 그림 중 고르고, 고른 것을 다시 누르면 끈다
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
  // 카메라 칸을 돌린 영상의 비율(가로/세로)로 만든다. 칸과 영상 비율이 같아 칸 안에 빈 띠가 생기지 않는다(CSS --cam-ratio)
  const camSize = frameSize.vw > 0 && frameSize.vh > 0 ? rotatedSize(frameSize.vw, frameSize.vh, rotation) : null
  const leftStyle = camSize ? ({ '--cam-ratio': (camSize.w / camSize.h).toFixed(4) } as CSSProperties) : undefined
  const [theme, toggleTheme] = useDemoTheme()
  const ink = theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)'
  // 워치 리듬 선 색. 글자에 쓰는 CSS --watch 와 같은 값이다
  const watchInk = theme === 'dark' ? '#c8f26b' : '#3f6b00'
  const webcam = useWebcam(videoRef, true)
  // rPPG 엔진이 매 프레임 BlazeFace 로 찾은 얼굴 상자를 감정 분석도 같이 쓴다(엔진이 돌지 않을 때만 SSD)
  const { displayBpm: rppgBpm, quality: rppgQuality, getPulse, reading: rppg, getFace, getFaceRate } = useHeartRateSource(videoRef, webcam === 'ready' && active, rotation)
  const watch = useWatch(rppg.bpm)
  // 확인 횟수를 쌓지 않는 순수 선택이므로 최초 연결·재연결·재시작 모두 새 상태로 평가한다.
  const selected = selectHeartRate({ ...watch, rppgBpm, rppgQuality })
  const bpm = active ? selected.bpm : null
  // 문자열 상수로 다시 만들어 React Compiler 가 아래 useCallback 의존값과 별개인 원시값으로 보게 한다
  const heartSource = selected.source === 'watch' ? 'watch' : selected.source === 'rppg' ? 'rppg' : null
  const watchPulse = useLivePulse(bpm ?? 0)
  // 워치 리듬 칸은 워치 BPM 리듬을 그린다. 수신 BPM 으로 만든 주기 애니메이션이며 실측 파형이 아니다.
  // 카메라 파형 칸은 늘 rPPG 실측 파형을 그린다. 오브 반짝임은 스트레스 단계 간격을 따른다(아래 stressBeat).
  const pulseFrom = pulseOrigin(active, heartSource)
  const watchLive = pulseFrom === 'watch'
  // 워치 리듬 칸은 측정 중 워치가 연결돼 있는 동안 계속 둔다. 대표 여부는 표본마다 다시 판정되므로
  // (8초 넘는 수신 간격·접촉 불량 표본 한 번) 그 값에 칸을 붙이면 칸이 떨어졌다 붙으며 파형이 처음부터 다시 그려진다.
  // 대표가 아닌 동안에는 평평한 선과 '수신 대기'를 보이고, 정상 표본이 오면 같은 칸에서 이어 그린다.
  const showWatchWave = active && watch.status === 'connected'
  const watchWavePulse = useCallback(() => watchLive ? watchPulse() : 0, [watchLive, watchPulse])
  // 파형 칸 이름표(2026-11-20 교수님 피드백): "스마트워치 (심박, bpm): 92", "rPPG (심박, bpm): 74" 형식으로 맞추고 숫자를 크게 둔다
  const watchWaveValue = watchLive ? bpmText(bpm) : '수신 대기'
  const cameraWaveValue = rppgWaveValue(rppg, rppgBpm)
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
  const [breathing, setBreathing] = useState<BreathingPlan | null>(null)
  // 호흡 안내 중에는 표본 저장을 멈춘다(그 전 표본은 멈춘 시각으로 저장, 세션 생존 갱신은 계속)
  const recording = useMeasureRecording(active && consent?.record === true, { nominalIntervalMs: FACE_INTERVAL_MS, paused: breathing !== null })
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
  // 오브 색은 순간 감정이 아니라 안정된 감정을 따른다. 반응 속도는 빠른 쪽('demo')으로 고정한다.
  const orbEmotion = useSteadyEmotion(active ? face.emotion : null, 'demo', 'calm', rotation)
  // 기록에는 얼굴을 찾은 순간의 감정만 남긴다. 못 찾은 순간을 마지막 색(기본 평온)으로 채우지 않는다.
  const finishLog = useSessionLog(active, bpm, active && face.emotion ? orbEmotion : null, rppgQuality, rppg.rawBpm,
    { latest: watch.latest, status: watch.status, rppgBpm })
  const lastSession = useStoredSession()
  const stored = useStoredOverview()
  // 표정(최근 1분 부정 표정)과 대표 심박(세션 첫 2분 대비 상승)을 결합한 지금 상태 (algorithm/stress/fusedStress)
  // 결합 판정에는 품질 기준을 통과한 심박만 넣는다(유효한 워치 또는 good 카메라). 참고값은 화면 숫자에만 쓴다
  const fused = useLiveFusedState(active, active ? fusionBpm(selected) : null, active ? face.emotions : null)
  // Electron 에서만: 측정 상태(감정 비율·측정 중·프레임)를 메인 프로세스로 보내 최소화 위젯이 그린다. 웹에서는 아무 일도 하지 않는다.
  // 위젯 오브도 측정 화면 오브처럼 스트레스 단계 색을 따른다(2026-11-20)
  const stressLevel = liveStressLevel(active, fused, stored?.baseline ?? null)
  // 오브 반짝임은 측정 맥박 파형이 아니라 스트레스 단계마다 정한 일정한 간격을 따른다(단계가 높을수록 자주).
  // 단계가 바뀌어도 박자 위치를 이어 가서 끊기지 않는다. 점수가 나오기 전에는 낮음 간격, 측정 전에는 반짝이지 않는다
  const stressBeat = useLivePulse(STRESS_BEAT_PER_MIN[stressLevel ?? 'low'])
  const orbPulse = useCallback(() => active ? stressBeat() : 0, [active, stressBeat])
  useDesktopMeasurementPublisher({
    active,
    emotions: active ? face.emotions : null,
    stressLevel,
    recordCount: recording.status?.saved ?? 0,
    videoEl,
    saveFailed: recording.status?.failed ?? false,
  })

  // 결과 화면을 미리 받아 둬서 측정 종료 뒤 이동할 때 경로 데이터·코드를 기다리지 않게 한다(배포 빌드에서만 동작)
  useEffect(() => {
    router.prefetch(RESULT_HREF)
  }, [router])

  /**
   * 측정 종료: 남은 1분 기록 저장을 마치고, 이번 측정 표본을 넘긴 뒤 결과 화면으로 간다.
   * 측정 상태(active)를 끄지 않고 바로 이동한다. 끄고 이동하면 이동 직전에 화면 전체가 '측정 종료' 상태로
   * 다시 그려지고(심박 '--', 오브 정지, 버튼 '측정 시작') 그 화면에서 멈췄다가 넘어가 끊겨 보였다.
   * 카메라·rPPG·저장·위젯 알림 정리는 화면을 떠날 때(unmount) 각 훅이 한다. 저장기 stop 은 여러 번 불러도 한 번만 처리한다.
   */
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
    router.push(RESULT_HREF)
  }

  const webcamReady = webcam === 'ready'
  const faceBadge = !webcamReady ? { on: false, text: '카메라 대기' }
    : active && face.box ? { on: true, text: '얼굴 추적 중' } : { on: false, text: '얼굴 찾는 중' }
  const emotion = face.emotionLabel ?? '—'
  // 오브는 스트레스 단계 색을 따르고, 아래에 단계 이름만 보인다(2026-11-20 교수님 피드백). 점수가 나오기 전에는 낮음 색으로 둔다
  const orbPalette = STRESS_PALETTE[stressLevel ?? 'low']
  const elapsedText = formatElapsed(elapsed)
  // 모니터링 Info(2026-11-20 교수님 피드백): 측정 시간·심박 신호 품질·얼굴 검출률·심박 측정 방식·기록 여부만 남긴다.
  // 결합 근거·오늘·14일 기준선·워치 행은 뺐다(오늘·14일은 리포트에서 본다). 워치 연결 버튼은 심박 측정 방식 행으로 옮겼다.
  const watchLiveBpm = watch.state === 'live' && watch.latest ? watch.latest.bpm : null
  const monitor: [string, string][] = [
    ['측정 시간', elapsedText],
    ['심박 신호 품질', signalQualityText(webcamReady, rppg, watchLiveBpm, rppg.bpm)],
    ['얼굴 검출률', faceRateText(webcamReady, getFaceRate())],
    ['심박 측정 방식', heartSourceText(active, heartSource, watch.state)],
    ['기록 여부', recordStateText(consent, active, recording.status)],
  ]
  const recordOn = consent?.record === true
  const menuItems: NavMenuItem[] = [
    ...(lastSession ? [{ key: 'result', label: '지난 측정 결과', hint: '마지막 측정 결과 보기', icon: MENU_ICON.result, href: RESULT_HREF }] : []),
    { key: 'breath', label: '숨 고르기', hint: '호흡 안내 따라 하기', icon: MENU_ICON.breath, onSelect: openBreathing },
    themeMenuItem(theme, toggleTheme),
  ]

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.measureShell}`} data-theme={theme}>
      <SkulletProvider mode={theme} theme={SKULLET_THEME} reveal="smart">
        <nav className={styles.nav}>
          <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
            ONMAUM
          </Link>
          <div className={styles.navMid}>
            <span className={`${styles.live} ${styles.mono}`}>
              {active && <span className={styles.liveDot} aria-hidden="true" />}
              <Morph>{`${active ? '측정 중' : '측정 종료'} ${elapsedText}`}</Morph>
            </span>
            {/* 지난 측정 결과·숨 고르기·화면 색은 메뉴 버튼 하나에 모은다(2026-11-20 교수님 피드백: 글자만 있으면 기능처럼 보이지 않음) */}
            <NavMenu items={menuItems} />
          </div>
        </nav>

        <div className={`${styles.body} ${styles.measureBody}`}>
          <div className={styles.left} style={leftStyle} data-waves={showWatchWave ? 2 : 1}>
            <div ref={setFrameEl} className={styles.frame}>
              <video ref={attachVideo} muted playsInline autoPlay style={videoStyle} />
              <FaceLayer box={active ? face.box : null} videoRef={videoRef} rotation={rotation} label={null} />
              <button
                type="button"
                className={`${styles.rotateBtn} ${styles.focusable}`}
                onClick={rotateCamera}
                aria-label={`카메라 화면 회전, 지금 ${rotation}도`}
                title="웹캠이 옆으로 누웠거나 뒤집혔을 때 눌러 바로 세웁니다"
              >
                ↻ {rotation}°
              </button>
              {/* 얼굴 추적 표시는 녹화 표시처럼 카메라 칸 아래 구석에 작게 둔다(2026-11-20 교수님 피드백) */}
              <span className={styles.faceBadge} data-on={faceBadge.on ? '' : undefined} role="status">
                <span className={styles.faceBadgeDot} aria-hidden="true" />
                {faceBadge.text}
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
            {/* 시연 배치: 워치가 연결되면 카메라 아래에 워치 리듬 칸, 맨 아래에 카메라 맥박 파형 칸을 둔다.
                워치 리듬 칸은 카메라 준비용 뼈대(Skeleton) 밖에 둬서 카메라·모델이 늦거나 실패해도 보이게 한다 */}
            {showWatchWave && (
              <div className={`${styles.waveBox} ${styles.watchWave}`}>
                <PulseCanvas getPulse={watchWavePulse} className={styles.wave} color={watchInk} />
                <WaveTag label={WATCH_WAVE_LABEL} value={watchWaveValue} />
              </div>
            )}
            <Skeleton loading={!ready} id="measure-wave" label="맥박 파형 준비 중">
              <div className={styles.waveBox} skullet-block="">
                <PulseCanvas getPulse={getPulse} className={styles.wave} color={ink} />
                <WaveTag label={RPPG_WAVE_LABEL} value={cameraWaveValue} />
              </div>
            </Skeleton>
          </div>

          <div className={`${styles.right} ${styles.demoRight}`}>
            {/*
              위쪽(2026-11-20 교수님 스케치): 왼쪽에 "심박 상태"·"감정 상태" 두 칸, 오른쪽에 "스트레스 상태" 오브.
              두 칸에서 오브로 흘러 들어가는 선을 그어, 심박과 표정이 합쳐져 스트레스 상태가 된다는 것을 보인다.
            */}
            <div className={styles.demoTop}>
              <div className={`${styles.stateBox} ${styles.heartBox}`}>
                <span className={styles.stateLabel}>심박 상태</span>
                <Skeleton loading={!ready && selected.source !== 'watch'} id="measure-head" label="심박 준비 중">
                  <div className={styles.bpmRow}>
                    <Morph className={styles.bpm}>{bpmText(bpm)}</Morph>
                    <span className={styles.unit}>bpm</span>
                  </div>
                </Skeleton>
              </div>
              <div className={`${styles.stateBox} ${styles.emotionBox}`}>
                <span className={styles.stateLabel}>감정 상태</span>
                <Skeleton loading={!ready} id="measure-key" label="감정 상태 준비 중">
                  {/* 감정 이름 오른쪽에 단색 선 얼굴을 붙인다(2026-11-22 팀 결정: 선 그림으로 고정). 감정이 바뀌면 그림이 짧게 서서히 나타난다 */}
                  <span className={styles.emotionRow}>
                    <Morph className={styles.stateValue}>{emotion}</Morph>
                    {face.emotion && <EmotionFace key={face.emotion} emotion={face.emotion} className={styles.emotionFace} />}
                  </span>
                </Skeleton>
              </div>
              {/* 두 선은 가운데쯤에서 한 줄로 모여 오브 가장자리까지 곧게 이어진다. 흐르는 점선은 지금 오브 색(스트레스 단계)을 띤다 */}
              <svg
                className={styles.flow}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                data-active={active ? '' : undefined}
                style={{ '--flow-ink': `rgb(${orbPalette.base.join(', ')})` } as CSSProperties}
              >
                <path className={styles.flowTrack} d={FLOW_PATH.heart} />
                <path className={styles.flowTrack} d={FLOW_PATH.emotion} />
                <path className={styles.flowDash} d={FLOW_PATH.heart} pathLength={100} />
                <path className={styles.flowDash} d={FLOW_PATH.emotion} pathLength={100} />
              </svg>
              <div className={styles.demoOrb}>
                <span className={styles.stateLabel}>스트레스 상태</span>
                {/* 오브 오른쪽에 세로 스트레스 게이지(낮음~매우 높음)를 붙인다. 게이지 높이는 오브 높이를 따른다(2026-11-21) */}
                <div className={styles.orbRow}>
                  <Skeleton loading={!ready && selected.source !== 'watch'} id="measure-orb" label="오브 준비 중">
                    <span skullet-block="" style={{ display: 'block', borderRadius: '50%' }}>
                      <DotOrb
                        getPulse={orbPulse}
                        palette={orbPalette}
                        bpm={bpm ?? undefined}
                        scheme={theme}
                        size={360}
                        className={styles.measureOrb}
                      />
                    </span>
                  </Skeleton>
                  <StressBar value={active && fused ? fused.s : null} level={stressLevel} baseline={stored?.baseline ?? null} />
                </div>
                <Morph className={styles.stressLevel}>{stressLevelText(active, stressLevel)}</Morph>
              </div>
            </div>
            {/*
              아래: 모니터링 Info. 다섯 행이 남는 높이를 똑같이 나눠 쓴다.
              카메라 준비용 뼈대(Skeleton)로 감싸지 않는다. 카메라·모델이 늦거나 실패해도 워치를 연결할 수 있어야 한다
            */}
            <section className={styles.monitor} aria-label="모니터링 Info">
              <h2 className={styles.monitorTitle}>모니터링 Info</h2>
              <div className={`${styles.rows} ${styles.monitorRows}`}>
                {monitor.map(([k, v]) => (
                  <div key={k} className={styles.row}>
                    <span className={styles.k}>{k}</span>
                    <span className={styles.monitorValue}>
                      <Morph className={styles.rowValue}>{v}</Morph>
                      {k === '심박 측정 방식' && watch.action && (
                        <button
                          type="button"
                          className={`${styles.preset} ${styles.focusable}`}
                          onClick={watch.action === 'connect' ? watch.connect : watch.disconnect}
                          title={watch.action === 'connect' ? WATCH_HINT : undefined}
                        >
                          {watch.action === 'connect' ? '워치 연결' : '워치 끊기'}
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            {/*
              기록 저장 버튼(2026-11-20 교수님 피드백): 모니터링 Info 바로 아래에 두고, 누르면 "기록 여부"가 저장 중으로,
              다시 누르면(저장 멈춤) 대기 중으로 바뀐다. 고른 값은 설문·기록 화면의 저장 여부와 같은 값으로 기억한다.
              저장 중 표시는 경고처럼 보이지 않게 빨강 대신 차분한 청록으로, 깜빡임 대신 느린 숨쉬기로 둔다
            */}
            <div className={styles.recordBar}>
              {/* 저장 여부를 아직 고르지 않았으면 처음 한 번 기록 저장 버튼 위에 묻는다. 고른 뒤에는 버튼으로 켜고 끈다 */}
              {consent === null && (
                <div className={styles.consentBox} role="region" aria-label="기록 저장 여부">
                  <p className={styles.consentText}>
                    측정하는 동안 1분마다 감정 요약을 이 기기에 저장할까요? 리포트·상태 확인·휴식 알림이 이 기록을 씁니다. 영상과 얼굴 사진은 저장하지 않습니다.
                    나중에 아래 기록 저장 버튼으로 바꿀 수 있습니다.
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
              <button
                type="button"
                className={`${styles.recordBtn} ${styles.focusable}`}
                data-on={recordOn ? '' : undefined}
                disabled={consent === undefined}
                onClick={() => decideConsent(!recordOn)}
              >
                <span className={styles.recordDot} aria-hidden="true" />
                {recordOn ? '저장 멈춤' : '기록 저장'}
              </button>
              <span className={styles.recordHint}>1분마다 감정 요약만 이 기기에 저장 · 영상·얼굴 사진은 저장하지 않음</span>
            </div>
            {/* 측정 시작·종료는 이 버튼 하나로 한다(위쪽 메뉴 버튼과 측정 스위치를 없앴다) */}
            <div style={{ marginTop: 'auto' }}>
              <button
                type="button"
                className={`${styles.btnSolid} ${styles.focusable}`}
                onClick={() => (active ? void endMeasure() : setActive(true))}
                disabled={ending}
                aria-busy={ending}
              >
                {ending ? '결과 정리 중' : active ? '측정 종료' : '측정 시작'}
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

/**
 * 심박·감정 칸에서 오브로 가는 선(viewBox 0~100, 늘여 그림). 두 칸 가운데(25·75)에서 출발해 x=45 에서 만나고,
 * 그 뒤로는 한 줄로 오브 가장자리(x=100)까지 간다. 두 선의 길이가 같아 모인 뒤 점선이 겹쳐 하나로 보인다
 */
const FLOW_PATH = {
  heart: 'M0,25 C26,25 22,50 45,50 L100,50',
  emotion: 'M0,75 C26,75 22,50 45,50 L100,50',
}

const WATCH_WAVE_LABEL = '스마트워치 (심박, bpm)'
const RPPG_WAVE_LABEL = 'rPPG (심박, bpm)'

/** rPPG 파형 칸 값: 숫자가 있으면 숫자, 없으면 엔진 상태. 참고값 표시는 하지 않는다(2026-11-20) */
function rppgWaveValue(reading: RppgReading, displayBpm: number | null): string {
  if (displayBpm !== null) return bpmText(displayBpm)
  return RPPG_STATUS_TEXT[reading.status]
}

/** 파형 칸 이름표: "이름: 값". 값은 한 단계 크게 */
function WaveTag({ label, value }: { label: string; value: string }) {
  return (
    <span className={`${styles.frameTag} ${styles.waveTag}`}>
      {label}: <Morph className={styles.waveTagValue}>{value}</Morph>
    </span>
  )
}
