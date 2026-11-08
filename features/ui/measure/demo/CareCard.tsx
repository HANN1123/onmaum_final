'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { careSuggestions, suggestionStart, type BreathingPlan, type CareMoment } from '@/features/feedback/lib/careActions'
import { loadProfile, type Profile } from '@/shared/storage/profile'
import styles from './measureDemo.module.css'

const SURVEY_HREF = '/demo/survey'

/**
 * 쉬어 가기 제안 카드. 처음 설문 답으로 고른 후보(careSuggestions)를 하나씩 보이고 "다른 제안"으로 돌린다.
 * 호흡 제안이면 "따라 하기"로 호흡 안내를 연다. 후보가 하나면 바꾸는 척하지 않도록 "다른 제안"을 숨긴다.
 * 설문에 답하지 않았으면 중립 제안과 함께 설문으로 가는 길을 보인다.
 */
export default function CareCard({
  moment,
  onBreathe,
  title = '쉬어 가기',
}: {
  moment: CareMoment
  onBreathe: (plan: BreathingPlan) => void
  title?: string
}) {
  // localStorage 는 클라이언트에서만 — 첫 렌더는 답 없음으로 서버와 맞추고, 그 뒤 실제 프로필을 읽는다
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(loadProfile())
  }, [])
  const list = useMemo(() => careSuggestions(profile ?? null, moment), [profile, moment])
  const [turn, setTurn] = useState(0)
  const start = useMemo(() => suggestionStart(list, moment, new Date()), [list, moment])
  const current = list[(start + turn) % list.length]
  const plan = current.breathing

  return (
    <div className={styles.careBox} aria-live="polite">
      <span className={styles.careLabel}>{title}</span>
      <p className={styles.careText}>{current.text}</p>
      <div className={styles.presets}>
        {plan && (
          <button
            type="button"
            className={`${styles.preset} ${styles.presetOn} ${styles.focusable}`}
            onClick={() => onBreathe(plan)}
          >
            따라 하기
          </button>
        )}
        {list.length > 1 && (
          <button type="button" className={`${styles.preset} ${styles.focusable}`} onClick={() => setTurn((t) => t + 1)}>
            다른 제안
          </button>
        )}
        {profile === null && (
          <Link href={SURVEY_HREF} className={`${styles.preset} ${styles.focusable}`} style={{ textDecoration: 'none' }}>
            설문으로 맞추기
          </Link>
        )}
      </div>
    </div>
  )
}
