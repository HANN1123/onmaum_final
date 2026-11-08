'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BREATHING_CAUTION,
  BREATHING_DONE,
  BREATHING_DURATION_NOTE,
  BREATHING_METHODS,
  BREATHING_READY,
  BREATHING_SOURCE,
  breathingAt,
  plannedSeconds,
  type BreathingDuration,
  type BreathingFrame,
  type BreathingTechnique,
} from '@/features/feedback/lib/breathing'
import type { BreathingPlan } from '@/features/feedback/lib/careActions'
import { mmss } from './demoBits'
import styles from './measureDemo.module.css'

type Stage = 'ready' | 'running' | 'done'

/**
 * 호흡 안내 창. 측정·결과·리포트 화면 위에 뜬다.
 * 준비 화면에서 방법(순환 한숨/느린 호흡)과 길이(1분/5분)를 고르고 시작한다. 진행 중에는 원이 숨에 맞춰 커지고 줄어든다.
 * 움직임을 줄이는 설정이면 원은 그대로 두고 글자만 바꾼다. 그만하기는 늘 보인다. Esc 로 닫는다.
 * 따라 하지 못했다고 실패로 표시하지 않고, 끝난 뒤 수치로 효과를 판정하지 않는다.
 */
export default function BreathingGuide({ plan, onClose }: { plan: BreathingPlan; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('ready')
  const [technique, setTechnique] = useState<BreathingTechnique>(plan.technique)
  const [duration, setDuration] = useState<BreathingDuration>(plan.durationSec)
  const [frame, setFrame] = useState<BreathingFrame | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const method = BREATHING_METHODS[technique]

  useEffect(() => {
    panelRef.current?.focus()
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduceMotion(media?.matches ?? false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (stage !== 'running') return
    const startedAt = performance.now()
    let raf = 0
    const tick = () => {
      const next = breathingAt(performance.now() - startedAt, duration, technique)
      setFrame(next)
      if (next.done) {
        setStage('done')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [stage, duration, technique])

  const scale = reduceMotion || !frame ? 0.7 : 0.35 + 0.65 * frame.scale

  return (
    <div className={styles.breathBackdrop}>
      <div
        ref={panelRef}
        className={styles.breathPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="breath-title"
        tabIndex={-1}
      >
        <div className={styles.breathTop}>
          <span className={styles.chip} id="breath-title">
            {method.title}
          </span>
          {/* 끝난 화면은 아래 닫기 버튼이 같은 역할을 한다 */}
          {stage !== 'done' && (
            <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={onClose}>
              {stage === 'running' ? '그만하기' : '닫기'}
            </button>
          )}
        </div>

        {stage === 'ready' && (
          <div className={styles.breathBody}>
            <p className={styles.breathLead}>{method.intro}</p>
            <p className={styles.verdictSub}>{BREATHING_READY}</p>
            <div className={styles.breathChoices}>
              <span className={styles.k}>방법</span>
              <span className={styles.presets}>
                {(['sigh', 'slow'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={technique === t}
                    className={`${styles.preset} ${styles.focusable} ${technique === t ? styles.presetOn : ''}`}
                    onClick={() => setTechnique(t)}
                  >
                    {t === 'sigh' ? '순환 한숨' : '느린 호흡'}
                  </button>
                ))}
              </span>
              <span className={styles.k}>길이</span>
              <span className={styles.presets}>
                {([60, 300] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={duration === d}
                    className={`${styles.preset} ${styles.focusable} ${duration === d ? styles.presetOn : ''}`}
                    onClick={() => setDuration(d)}
                  >
                    {d / 60}분
                  </button>
                ))}
              </span>
            </div>
            <p className={styles.notice}>{BREATHING_DURATION_NOTE[duration]}</p>
            <p className={styles.notice}>{BREATHING_CAUTION}</p>
            <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={() => setStage('running')}>
              시작 · 약 {mmss(plannedSeconds(duration, technique))}
            </button>
          </div>
        )}

        {stage === 'running' && frame && (
          <div className={styles.breathBody}>
            <div className={styles.breathStage} aria-hidden="true">
              <span className={styles.breathCircle} style={{ transform: `scale(${scale})` }} />
            </div>
            <p className={styles.breathCue} aria-live="polite">
              {frame.step?.label}
            </p>
            <p className={`${styles.verdictSub} ${styles.mono}`}>
              {frame.cycle}번째 · 남은 시간 {mmss(frame.remainingSec)}
            </p>
            <p className={styles.notice}>{BREATHING_CAUTION}</p>
          </div>
        )}

        {stage === 'done' && (
          <div className={styles.breathBody}>
            <p className={styles.breathLead}>{BREATHING_DONE}</p>
            <p className={styles.verdictSub}>개인마다 느낌은 다를 수 있어요. 편할 때 다시 해 보세요.</p>
            <div className={styles.actions}>
              <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={onClose}>
                닫기
              </button>
              <button type="button" className={`${styles.btnGhost} ${styles.focusable}`} onClick={() => setStage('running')}>
                한 번 더
              </button>
            </div>
          </div>
        )}

        <p className={styles.breathSource}>{BREATHING_SOURCE}</p>
      </div>
    </div>
  )
}
