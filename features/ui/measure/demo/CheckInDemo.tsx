'use client'

import { useEffect, useState } from 'react'
import { useCheckin } from '@/features/feedback/hooks/useCheckin'
import type { SelfReport } from '@/features/algorithm/baseline/calibration'
import type { CheckinSlot } from '@/features/feedback/lib/checkin'
import styles from './measureDemo.module.css'

const SLOT_LABEL: Record<CheckinSlot, string> = { morning: '오전 상태 확인', afternoon: '오후 상태 확인' }
/** 체크인 시간대에 들어오고 나가는 것을 알 수 있게 1분마다 시각을 새로 잡는다 */
const TICK_MS = 60_000

/**
 * 하루 리포트의 상태 확인(코드 이름은 체크인). 화면에는 "체크인" 대신 "상태 확인"이라 쓴다. 조건(시간대·최근 30분 기록·응답 여부·끈 시간대)은 useCheckin 이 정한다.
 * 측정 기록으로 본 최근 30분 판정이 맞는지 묻고, 답은 다음 판정 보정에 쓴다(맞아요 0, 더 힘들었어요 +3, 괜찮았어요 −3).
 * 응답하면 감사 문구로 바꾸고 다시 묻지 않는다.
 */
export default function CheckInDemo() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(timer)
  }, [])
  const checkin = useCheckin({ now })
  const [askDirection, setAskDirection] = useState(false)
  const [thanked, setThanked] = useState<CheckinSlot | null>(null)

  const report = (r: SelfReport) => {
    checkin.submit(r)
    setThanked(checkin.slot)
    setAskDirection(false)
  }

  if (thanked) {
    return (
      <div className={styles.careBox} role="status">
        <span className={styles.careLabel}>{SLOT_LABEL[thanked]}</span>
        <p className={styles.careText}>알려 줘서 고마워요. 다음 판정부터 조금씩 반영할게요.</p>
      </div>
    )
  }
  if (!checkin.due || !checkin.slot) return null

  return (
    <div className={styles.careBox} role="region" aria-label={SLOT_LABEL[checkin.slot]}>
      <span className={styles.careLabel}>{SLOT_LABEL[checkin.slot]} · 최근 30분 기록 기준</span>
      <p className={styles.careText}>{checkin.line}</p>
      <div className={styles.presets}>
        {!askDirection ? (
          <>
            <button type="button" className={`${styles.preset} ${styles.presetOn} ${styles.focusable}`} onClick={() => report('agree')}>
              맞아요
            </button>
            <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={() => setAskDirection(true)}>
              지금은 좀 달라요
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={() => report('worse')}>
              더 힘들었어요
            </button>
            <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={() => report('better')}>
              사실 괜찮았어요
            </button>
          </>
        )}
      </div>
    </div>
  )
}
