'use client'

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { BASELINE_WINDOW_DAYS, classifyStress, computeBaselineState, type StressLevel } from '@/features/algorithm/baseline/baseline'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { Row, Stat } from './demoBits'
import { LEGAL } from './demoCopy'
import styles from './measureDemo.module.css'
import { formatClock, sampleCalls, sampleHistory } from './reportSamples'
import { Roll, Swap } from './Roll'
import { LEVEL_SHORT } from './sessionLog'
import { useStoredSession } from './useStoredSession'

/**
 * 기록 화면 데모. 측정·결과·리포트와 같은 틀.
 * 왼쪽은 지난 14일. 한 줄이 하루이고, 막대는 그날 스트레스, 세로 눈금은 평소다. 줄을 훑으면 위쪽 큰 숫자가 그날을 읽는다.
 * 오른쪽은 내 기록 관리(내보내기·가져오기·지우기). 데모는 표본 기록을 보여주므로 버튼은 실제 기록을 건드리지 않는다.
 * 평소 기준선과 날마다의 판정은 algorithm/baseline 의 실제 함수로 계산한다.
 */

const MEASURE_HREF = '/demo/measure'
const REPORT_HREF = '/demo/report'
const HERO_HREF = '/demo/hero-dark'

/** 분 단위의 지금. 서버에서는 0 이라 날짜 글자가 어긋나지 않고, 하이드레이션 뒤 한 번 채워진다. */
const subscribe = () => () => {}
const readMinute = () => Math.floor(Date.now() / 60000)
const serverMinute = () => 0

interface Day {
  date: string
  label: string
  isToday: boolean
  stress: number | null
  minutes: number
  calls: number
  level: StressLevel | null
}

export default function RecordsDemo() {
  const [theme, toggleTheme] = useDemoTheme()
  const minute = useSyncExternalStore(subscribe, readMinute, serverMinute)
  const now = useMemo(() => (minute ? new Date(minute * 60000) : null), [minute])
  const history = useMemo(() => sampleHistory(now ?? new Date(0)), [now])
  const baseline = useMemo(() => computeBaselineState(history), [history])
  const baselineN = baseline.baselineN
  const stored = useStoredSession()

  const days = useMemo<Day[]>(() => {
    const today = sampleCalls(stored ? new Date(stored.endedAt) : (now ?? new Date(0)))
    const todaySec = today.reduce((sum, c) => sum + c.durationSec, 0) + (stored?.durationSec ?? 0)
    const todayCalls = today.length + (stored ? 1 : 0)
    return history
      .map((p, i) => {
        const isToday = i === history.length - 1
        const stress = p.scores ? Math.round(p.scores.stress) : null
        const minutes = isToday ? Math.round(todaySec / 60) : Math.round(p.totalDuration / 60000)
        return {
          date: p.date,
          label: dayLabel(p.date, now),
          isToday,
          stress,
          minutes,
          // 표본: 지난 날의 통화 수는 측정 시간에서 어림한다(평균 9분).
          calls: isToday ? todayCalls : stress === null ? 0 : Math.max(1, Math.round(minutes / 9)),
          level: stress === null ? null : classifyStress(stress, baseline),
        }
      })
      .reverse()
  }, [history, baseline, stored, now])

  const [selected, setSelected] = useState<number | null>(null)
  const shown = days[selected ?? 0]
  const diff = shown.stress !== null && baselineN !== null ? shown.stress - Math.round(baselineN) : null
  const readSide =
    shown.stress === null ? '측정 없음' : diff === null ? '' : diff === 0 ? '평소와 같음' : `평소보다 ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`
  const readLabel = `${shown.label}${shown.isToday ? ' · 오늘' : ''}`
  const readSub = shown.calls > 0 ? `통화 ${shown.calls}건 · ${shown.minutes}분` : '이날은 측정하지 않았습니다'

  const scaleMax = useMemo(() => {
    const max = days.reduce((m, d) => Math.max(m, d.stress ?? 0), baselineN ?? 0)
    return Math.max(40, Math.ceil((max * 1.25) / 10) * 10)
  }, [days, baselineN])
  const pct = (v: number) => `${(v / scaleMax) * 100}%`

  const recorded = days.filter((d) => d.stress !== null)
  const totalCalls = days.reduce((sum, d) => sum + d.calls, 0)
  const totalMinutes = days.reduce((sum, d) => sum + d.minutes, 0)
  const lastCall = stored ? formatClock(new Date(stored.endedAt)) : sampleCalls(now ?? new Date(0))[0]?.time ?? '–'

  // 내 기록 관리(데모): 실제 기록은 건드리지 않고 무슨 일이 일어나는지만 보여준다.
  const [confirming, setConfirming] = useState(false)
  const [alsoSettings, setAlsoSettings] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileName = `onmaum-records-${now ? now.toLocaleDateString('en-CA') : 'today'}.json`

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.readable}`} data-theme={theme}>
      <nav className={styles.nav}>
        <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono}`}>기록 · 최근 {BASELINE_WINDOW_DAYS}일</span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          다음 통화
        </Link>
      </nav>

      <div className={styles.body}>
        <div className={`${styles.panel} ${styles.recordsPanel}`}>
          <div className={styles.readout}>
            <Swap text={readLabel} className={styles.readoutLabel} />
            <div className={styles.readoutMain}>
              <Roll value={shown.stress === null ? '–' : String(shown.stress)} className={styles.readoutValue} />
              <span className={`${styles.readoutSide} ${styles.readoutSideDim}`}>
                <Swap text={readSide} />
              </span>
            </div>
            <Swap text={readSub} className={styles.readoutSub} />
          </div>

          <ul className={styles.dayList} onPointerLeave={() => setSelected(null)}>
            {days.map((d, i) => (
              <li
                key={d.date}
                className={`${styles.day} ${d.isToday ? styles.dayToday : ''} ${selected === i ? styles.dayOn : ''}`}
                onPointerEnter={() => setSelected(i)}
              >
                <span className={styles.dayDate}>
                  {d.label}
                  {d.isToday && <em>오늘</em>}
                </span>
                <span className={styles.dayCalls}>{d.calls > 0 ? `${d.calls}건 · ${d.minutes}분` : '–'}</span>
                <span className={styles.dayTrack} aria-hidden="true">
                  {d.stress !== null && <i className={styles.dayFill} style={{ width: pct(d.stress) }} />}
                  {baselineN !== null && <b className={styles.dayBase} style={{ left: pct(baselineN) }} />}
                </span>
                <span className={styles.dayLevel}>{d.level ? LEVEL_SHORT[d.level] : '측정 없음'}</span>
                {d.isToday ? (
                  <Link href={REPORT_HREF} className={`${styles.dayLink} ${styles.focusable}`}>
                    리포트
                  </Link>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.right}>
          <div className={styles.head}>
            <div className={styles.verdictBox}>
              <span className={styles.chip}>내 기록 관리</span>
              <p className={styles.verdict}>기록은 이 기기 안에만 있습니다</p>
              <p className={styles.verdictSub}>파일로 내보내 다른 기기로 옮기거나, 한 번에 지울 수 있습니다. 영상은 처음부터 저장하지 않습니다.</p>
            </div>
          </div>

          <div className={styles.stats}>
            <Stat k="기록한 날" v={String(recorded.length)} unit="일" />
            <Stat k="통화" v={String(totalCalls)} unit="건" />
            <Stat k="측정 시간" v={String(Math.floor(totalMinutes / 60))} unit={`시간 ${totalMinutes % 60}분`} />
          </div>

          <div className={styles.rows}>
            <Row k="저장 위치" v="이 기기 · 브라우저 저장소" />
            <Row k="마지막 통화" v={`오늘 ${lastCall}`} />
          </div>

          <div className={styles.manage}>
            {confirming ? (
              <div className={styles.confirm} role="group" aria-label="모든 기록 지우기 확인">
                <p>측정 기록, 체크인과 알림 기록을 모두 지웁니다. 지운 기록은 되돌릴 수 없습니다.</p>
                <label className={styles.check}>
                  <input type="checkbox" checked={alsoSettings} onChange={(e) => setAlsoSettings(e.target.checked)} />
                  알림 설정과 처음 설문 답변도 함께 지우기
                </label>
                <div className={styles.actions}>
                  <button type="button" className={`${styles.btnGhost} ${styles.focusable}`} onClick={() => setConfirming(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnDanger} ${styles.focusable}`}
                    onClick={() => {
                      setConfirming(false)
                      setNotice(`데모라서 실제 기록은 그대로 둡니다. 실제 화면에서는 여기서 ${alsoSettings ? '설정까지 ' : ''}모두 지웁니다.`)
                    }}
                  >
                    지우기
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.btnSolid} ${styles.focusable}`}
                    onClick={() => setNotice(`${fileName} 로 내보냅니다. 데모라서 파일은 만들지 않습니다.`)}
                  >
                    파일로 내보내기
                  </button>
                  <button
                    type="button"
                    className={`${styles.btnGhost} ${styles.focusable}`}
                    onClick={() => setNotice('다른 기기에서 내보낸 파일을 고르면 기록을 합칩니다. 데모라서 파일을 열지 않습니다.')}
                  >
                    파일 가져오기
                  </button>
                </div>
                <button type="button" className={`${styles.textDanger} ${styles.focusable}`} onClick={() => setConfirming(true)}>
                  모든 기록 지우기
                </button>
              </>
            )}
            {notice && (
              <p key={notice} className={styles.notice} role="status">
                {notice}
              </p>
            )}
          </div>
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

/** 11/3 (화). 서버에서는 날짜를 모르므로 월/일만. */
function dayLabel(dateKey: string, now: Date | null): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!now) return `${m}/${d}`
  const weekday = new Date(y, m - 1, d).toLocaleDateString('ko-KR', { weekday: 'short' })
  return `${m}/${d} (${weekday})`
}
