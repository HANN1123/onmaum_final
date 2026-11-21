import type { CSSProperties } from 'react'
import type { BaselineState, StressLevel } from '@/features/algorithm/baseline/baseline'
import { STRESS_LEVEL_TEXT } from './fusedText'
import styles from './measureDemo.module.css'
import { STRESS_PALETTE } from './orbs/stressPalette'
import { GAUGE_LEVELS, gaugePosition } from './gaugePosition'

interface Props {
  /** 오늘 스트레스(보정값을 더한 값). 저장된 기록이 없으면 null */
  value: number | null
  level: StressLevel | null
  baseline: BaselineState | null
  /** 기록을 아직 읽는 중 */
  loading?: boolean
}

/**
 * 스트레스 상태 (오늘) 게이지. 네 칸 막대 위에 단계 이름, 아래에 ▲ 와 오늘 값을 둔다(2026-11-20 교수님 피드백 E3).
 * 칸 색은 측정 화면 오브의 단계 색과 같고, 오늘 단계의 칸만 진하게 켠다.
 */
export default function StressGauge({ value, level, baseline, loading = false }: Props) {
  const shown = value !== null && level !== null && baseline !== null
  const rounded = shown ? Math.round(value) : null
  const status = loading ? '읽는 중' : shown ? STRESS_LEVEL_TEXT[level] : '저장된 기록 없음'

  return (
    <div
      className={styles.gauge}
      role="img"
      aria-label={shown ? `오늘 스트레스 ${rounded}, ${STRESS_LEVEL_TEXT[level]}` : `오늘 스트레스 ${status}`}
    >
      <div className={styles.gaugeHead}>
        <span className={styles.gaugeTitle}>스트레스 상태 (오늘)</span>
        <span className={styles.gaugeStatus}>{status}</span>
      </div>
      <div className={styles.gaugeNames} aria-hidden="true">
        {GAUGE_LEVELS.map((l) => (
          <span key={l} data-on={l === level}>
            {STRESS_LEVEL_TEXT[l]}
          </span>
        ))}
      </div>
      <div className={styles.gaugeTrack} aria-hidden="true">
        {GAUGE_LEVELS.map((l) => (
          <span
            key={l}
            className={styles.gaugeCell}
            data-on={l === level}
            style={{ '--cell-rgb': STRESS_PALETTE[l].base.join(', ') } as CSSProperties}
          />
        ))}
      </div>
      <div className={styles.gaugeMarkRow} aria-hidden="true">
        {/* ▲ 끝은 값 자리에 두고, 숫자는 막대 안쪽(왼쪽 절반이면 오른쪽, 오른쪽 절반이면 왼쪽)에 붙여 막대 밖으로 넘치지 않게 한다 */}
        {shown && (
          <span
            className={styles.gaugeMark}
            data-side={gaugePosition(value, level, baseline) < 0.5 ? 'right' : 'left'}
            style={{ left: `${gaugePosition(value, level, baseline) * 100}%` }}
          >
            <i>▲</i>
            <b>{rounded}</b>
          </span>
        )}
      </div>
    </div>
  )
}

const ABSOLUTE: BaselineState = { mode: 'absolute', baselineN: null }

/**
 * 측정 화면 오브 오른쪽의 세로 스트레스 게이지(2026-11-21). 아래가 낮음, 위가 매우 높음.
 * 결과 화면 게이지와 같은 칸 색·같은 위치 계산을 쓰고, 지금 단계의 칸만 진하게 켠다.
 * 측정 화면에는 점수를 보이지 않으므로(2026-11-20 교수님 피드백 B6) ▶ 표시로 위치만 보인다.
 * 기준선을 아직 읽지 못했으면 절대 기준으로 위치를 잡는다(단계 판정과 같은 기준).
 */
export function StressBar({ value, level, baseline }: { value: number | null; level: StressLevel | null; baseline: BaselineState | null }) {
  const pos = value !== null && level !== null ? gaugePosition(value, level, baseline ?? ABSOLUTE) : null
  const topDown = [...GAUGE_LEVELS].reverse()
  return (
    <div className={styles.stressBar} role="img" aria-label={level ? `지금 스트레스 ${STRESS_LEVEL_TEXT[level]}` : '지금 스트레스 측정 전'}>
      <div className={styles.stressBarTrack} aria-hidden="true">
        {topDown.map((l) => (
          <span
            key={l}
            className={styles.gaugeCell}
            data-on={l === level}
            style={{ '--cell-rgb': STRESS_PALETTE[l].base.join(', ') } as CSSProperties}
          />
        ))}
        {pos !== null && (
          <span className={styles.stressBarMark} data-mark="" style={{ bottom: `${pos * 100}%` }}>
            ▶
          </span>
        )}
      </div>
      <div className={styles.stressBarNames} aria-hidden="true">
        {topDown.map((l) => (
          <span key={l} data-on={l === level}>
            {STRESS_LEVEL_TEXT[l]}
          </span>
        ))}
      </div>
    </div>
  )
}
