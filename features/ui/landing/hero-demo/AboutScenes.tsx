'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { EMOTION_LABELS, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import CallChart, { type ScrubReason } from '@/features/ui/measure/demo/CallChart'
import { mmss, swatchColor, useLivePulse } from '@/features/ui/measure/demo/demoBits'
import DotOrb from '@/features/ui/measure/demo/orbs/DotOrb'
import { Roll, Swap } from '@/features/ui/measure/demo/Roll'
import { hardestWithEmotion, makeSampleSession, smoothBpm, summarizeSession } from '@/features/ui/measure/demo/sessionLog'
import styles from './HeroAbout.module.css'

/**
 * 소개 섹션의 제품 장면 셋. 모두 실제 측정·결과·기록 화면의 부품을 그대로 쓴다.
 * 화면에 보일 때만 움직이고, 보이기 시작하면 처음부터 다시 시작한다. 움직임 줄이기 설정이면 멈춘 한 장면만 보여준다.
 * 장면은 잘리지 않고 통째로 보인다.
 */

type Scheme = 'dark' | 'light'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 요소가 화면에 35% 이상 보이는 동안 true */
function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, inView]
}

/* ───────── 1. 통화하는 동안: 오브의 색은 감정, 빠르기는 심박 ───────── */

const ORB_STEPS: { emotion: Emotion; bpm: number }[] = [
  { emotion: 'calm', bpm: 72 },
  { emotion: 'angry', bpm: 104 },
  { emotion: 'sad', bpm: 82 },
  { emotion: 'happy', bpm: 76 },
]

export function OrbScene({ scheme }: { scheme: Scheme }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [step, setStep] = useState(0)
  const light = scheme === 'light'

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return
    const id = window.setInterval(() => setStep((s) => (s + 1) % ORB_STEPS.length), 3400)
    return () => window.clearInterval(id)
  }, [inView])

  const { emotion, bpm } = ORB_STEPS[step]
  const getPulse = useLivePulse(bpm)

  return (
    <div ref={ref} className={`${styles.scene} ${styles.orbScene}`} aria-hidden="true">
      <DotOrb getPulse={getPulse} emotion={emotion} bpm={bpm} scheme={scheme} size={220} colorEase={0.08} />
      <div className={styles.read}>
        <span className={styles.readLabel}>통화 중 · 지금</span>
        <span className={styles.readValue}>
          <Roll value={String(bpm)} />
          <small>BPM</small>
        </span>
        <span className={styles.readEmotion}>
          <i style={{ background: swatchColor(emotion, light) }} />
          <Swap text={EMOTION_LABELS[emotion]} />
        </span>
        <span className={styles.readNote}>색은 감정, 빠르기는 심박</span>
      </div>
    </div>
  )
}

/* ───────── 2. 통화가 끝나면: 실제 결과 차트, 가장 힘든 구간으로 다가간다 ───────── */

const SESSION = makeSampleSession()
const CYCLE_MS = 9800

export function ResultScene({ scheme }: { scheme: Scheme }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [cycle, setCycle] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const [reason, setReason] = useState<ScrubReason>('pointer')
  const light = scheme === 'light'

  // 보이는 동안 일정한 간격으로 차트를 새로 띄워 그리기와 카메라를 되풀이한다.
  useEffect(() => {
    if (!inView || prefersReducedMotion()) return
    const id = window.setInterval(() => {
      setActive(null)
      setCycle((c) => c + 1)
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [inView])

  const summary = useMemo(() => summarizeSession(SESSION), [])
  const smooth = useMemo(() => smoothBpm(SESSION.samples.map((s) => s.bpm)), [])
  const hardest = useMemo(() => hardestWithEmotion(SESSION, summary), [summary])

  const point = active !== null ? SESSION.samples[active] : null
  const label = point ? (reason === 'camera' ? `가장 힘든 순간 · ${mmss(point.t)}` : mmss(point.t)) : '통화 평균'
  const value = point ? Math.round(smooth[active!]) : summary.avgBpm
  const emotion = point ? point.emotion : summary.dominant

  return (
    <div ref={ref} className={`${styles.scene} ${styles.resultScene}`}>
      <div className={styles.read}>
        <Swap text={label} className={styles.readLabel} />
        <span className={styles.readValue}>
          <Roll value={String(value)} />
          <small>BPM</small>
          <span className={styles.readEmotion}>
            <i style={{ background: swatchColor(emotion, light) }} />
            <Swap text={EMOTION_LABELS[emotion]} />
          </span>
        </span>
      </div>
      <div className={styles.chartBox}>
        {inView && (
          <CallChart
            key={cycle}
            points={SESSION.samples}
            smooth={smooth}
            durationSec={SESSION.durationSec}
            hardest={hardest}
            shares={summary.shares}
            scheme={scheme}
            active={active}
            onScrub={(index, why = 'pointer') => {
              setActive(index)
              setReason(why)
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ───────── 3. 이 기기 안에만: 기록 목록에서 파일로 내보낸다 ───────── */

const ROWS = [
  { day: '오늘', calls: '6건 · 45분', w: 0.42, today: true },
  { day: '어제', calls: '11건 · 99분', w: 0.62 },
  { day: '2일 전', calls: '8건 · 72분', w: 0.48 },
  { day: '3일 전', calls: '10건 · 94분', w: 0.58 },
  { day: '4일 전', calls: '15건 · 131분', w: 0.86 },
]

type ExportPhase = 'idle' | 'arrive' | 'press' | 'done'

export function RecordsScene() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [phase, setPhase] = useState<ExportPhase>('idle')

  // 커서가 다가와 내보내기를 누르고, 파일이 생기고, 잠시 뒤 함께 물러난다.
  useEffect(() => {
    if (prefersReducedMotion()) {
      // 움직임 줄이기: 파일이 생긴 결과 한 장면만. 서버 첫 화면과 어긋나지 않게 하이드레이션 뒤에 바꾼다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('done')
      return
    }
    if (!inView) return
    const timers: number[] = []
    const run = () => {
      timers.push(window.setTimeout(() => setPhase('arrive'), 900))
      timers.push(window.setTimeout(() => setPhase('press'), 1900))
      timers.push(window.setTimeout(() => setPhase('done'), 2060))
      timers.push(window.setTimeout(() => setPhase('idle'), 5200))
    }
    run()
    const id = window.setInterval(run, 6400)
    return () => {
      window.clearInterval(id)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [inView])

  return (
    <div ref={ref} className={`${styles.scene} ${styles.recordsScene}`} aria-hidden="true">
      <div className={styles.deviceHead}>
        <span>이 기기</span>
        <span className={styles.dim}>서버로 보내지 않음</span>
      </div>
      <ul className={styles.rows}>
        {ROWS.map((r) => (
          <li key={r.day} className={r.today ? styles.rowToday : undefined}>
            <span>{r.day}</span>
            <span className={styles.dim}>{r.calls}</span>
            <span className={styles.track}>
              <i style={{ width: `${r.w * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.exportRow}>
        <span className={styles.exportBtn} data-pressed={phase === 'press' ? '' : undefined}>
          파일로 내보내기
          <span className={styles.cursor} data-on={phase === 'arrive' || phase === 'press' ? '' : undefined} data-pressed={phase === 'press' ? '' : undefined}>
            <svg height="24" width="24" viewBox="0 0 32 32" fill="none">
              <g transform="translate(10 7)">
                <path d="m6.148 18.473 1.863-1.003 1.615-.839-2.568-4.816h4.332l-11.379-11.408v16.015l3.316-3.221z" fill="#fff" />
                <path d="m6.431 17 1.765-.941-2.775-5.202h3.604l-8.025-8.043v11.188l2.53-2.442z" fill="#000" />
              </g>
            </svg>
          </span>
        </span>
        <span className={styles.file} data-on={phase === 'done' ? '' : undefined}>
          onmaum-records.json · 24KB 저장됨
        </span>
      </div>
    </div>
  )
}
