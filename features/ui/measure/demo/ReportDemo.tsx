'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { EMOTION_LABELS, getDominantEmotion, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { PERIOD_BUCKET_HOURS } from '@/features/algorithm/stress/dailyStress'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { mmss, Row, Stat, swatchColor } from './demoBits'
import { LEGAL } from './demoCopy'
import { NO_PULSE } from './heartRate'
import styles from './measureDemo.module.css'
import DotOrb from './orbs/DotOrb'
import { Roll, Swap } from './Roll'
import { isSameLocalDay, summarizeSession } from './sessionLog'
import { dayLevelCopy, type StoredOverview } from './storedOverview'
import { useStoredOverview } from './useStoredOverview'
import { useStoredSession } from './useStoredSession'
import BreathingGuide from './BreathingGuide'
import CareCard from './CareCard'
import CheckInDemo from './CheckInDemo'
import type { BreathingPlan } from '@/features/feedback/lib/careActions'

/**
 * 하루 리포트 화면 데모. 측정·결과 화면과 같은 틀.
 * 14일 막대 위의 큰 숫자가 읽어 주는 값이다. 막대를 훑으면 그날의 스트레스와 평소와의 차이로 굴러 바뀐다(Stageshow 의 차트 스크럽).
 * 왼쪽은 14일 스트레스 막대(점선이 평소)와 오늘 측정 목록, 오른쪽은 하루 판정·숫자 셋·행·버튼.
 * 숫자와 판정은 모두 이 기기에 저장된 실제 기록을 algorithm 의 기존 함수로 계산한다(storedOverview).
 * 방금 끝낸 측정이 저장됐으면(sessionId) 목록의 그 세션에서 결과 화면으로 잇는다.
 * 저장하지 않은 측정이 오늘이면 목록 맨 위에 따로 올리고, 숫자에는 넣지 않는다.
 * 심박은 저장하지 않으므로 하루 리포트에는 심박 숫자를 만들지 않는다(측정 결과 화면에서만 보인다).
 * 오른쪽에는 체크인(시간대·최근 30분 기록이 있을 때)과 쉬는 시간·퇴근 후 제안(CareCard)을 둔다.
 */

const MEASURE_HREF = '/demo/measure'
const RESULT_HREF = '/demo/result'
const HERO_HREF = DEMO_HOME_HREF
const SHARE_ORDER: Emotion[] = ['calm', 'happy', 'sad', 'angry']

interface ListRow {
  key: string
  time: string
  durationSec: number
  emotion: Emotion | null
  note: string
  href?: string
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function ReportDemo() {
  const [theme, toggleTheme] = useDemoTheme()
  const light = theme === 'light'
  const stored = useStoredOverview()
  const recent = useStoredSession()
  const [active, setActive] = useState<number | null>(null)

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.readable}`} data-theme={theme}>
      <nav className={styles.nav}>
        <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono}`}>오늘 {stored ? todayLabel(stored) : ''}</span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          측정 시작
        </Link>
      </nav>

      {stored ? (
        <Report stored={stored} recent={recent} light={light} theme={theme} active={active} setActive={setActive} />
      ) : (
        <div className={styles.body}>
          <p className={styles.verdictSub}>기록을 읽는 중입니다</p>
        </div>
      )}
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

function Report({
  stored,
  recent,
  light,
  theme,
  active,
  setActive,
}: {
  stored: StoredOverview
  recent: ReturnType<typeof useStoredSession>
  light: boolean
  theme: 'dark' | 'light'
  active: number | null
  setActive: (index: number | null) => void
}) {
  const { history, baseline, today } = stored
  const baselineN = baseline.baselineN
  const [breathing, setBreathing] = useState<BreathingPlan | null>(null)
  const days = stored.days
  const todayIndex = days.length - 1

  // 막대 눈금 상한: 가장 높은 날의 1.3배를 10 단위로 올림. 평소선도 같은 눈금을 쓴다.
  const scaleMax = useMemo(() => {
    const max = days.reduce((m, d) => Math.max(m, d.stress ?? 0), baselineN ?? 0)
    return Math.max(40, Math.ceil((max * 1.3) / 10) * 10)
  }, [days, baselineN])
  const pct = (v: number) => `${(v / scaleMax) * 100}%`

  const rows = useMemo<ListRow[]>(() => {
    const list: ListRow[] = today.sessions.map((s) => ({
      key: s.id,
      time: formatClock(s.startedAt),
      durationSec: s.durationSec,
      emotion: s.dominant,
      note: s.active ? '측정 중' : s.stress === null ? '기록 없음' : `스트레스 ${Math.round(s.stress)}`,
      href: recent?.sessionId === s.id ? RESULT_HREF : undefined,
    }))
    // 방금 끝낸 측정 중 저장하지 않은 것. 오늘 끝낸 것만 올린다.
    if (recent && !recent.sessionId && isSameLocalDay(new Date(recent.endedAt), new Date(history[history.length - 1].date + 'T12:00:00'))) {
      const summary = summarizeSession(recent)
      list.unshift({
        key: 'recent',
        time: formatClock(new Date(recent.startedAt)),
        durationSec: recent.durationSec,
        emotion: summary.dominant,
        note: '방금 측정 · 저장 안 함',
        href: RESULT_HREF,
      })
    }
    return list
  }, [today.sessions, recent, history])

  const storedSec = today.sessions.reduce((sum, s) => sum + s.durationSec, 0)
  const dominant = today.shares ? getDominantEmotion(today.shares) : null
  const hardestText =
    today.hardestStartHour === null ? '고를 수 있는 시간대 없음' : `${today.hardestStartHour}–${today.hardestStartHour + PERIOD_BUCKET_HOURS}시`
  const verdict = today.level === null ? '오늘은 아직 저장된 측정 기록이 없습니다' : dayLevelCopy(today.level, baseline)
  const sub =
    today.level === null
      ? '측정을 하면 오늘의 스트레스와 평소와의 차이가 여기에 나옵니다.'
      : `오늘 측정 ${today.sessions.length}회 · ${Math.round(storedSec / 60)}분을 바탕으로 했습니다.`

  // 위쪽 큰 숫자: 평소엔 오늘, 막대를 훑는 동안엔 그날
  const shown = active ?? todayIndex
  const shownDay = days[shown]
  const shownValue = shownDay.stress === null ? null : Math.round(shownDay.stress)
  const readLabel = shown === todayIndex ? '오늘 스트레스' : `${axisLabel(shownDay.date, false)} 스트레스`
  const diff = shownValue !== null && baselineN !== null ? shownValue - Math.round(baselineN) : null
  const readSide =
    shownValue === null ? '측정 없음' : diff === null ? '' : diff === 0 ? '평소와 같음' : `평소보다 ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`

  return (
    <div className={styles.body}>
      <div className={styles.reportLeft}>
        <div className={`${styles.frame} ${styles.chartFrame} ${styles.reportChart}`}>
          <div className={styles.readout}>
            <Swap text={readLabel} className={styles.readoutLabel} />
            <div className={styles.readoutMain}>
              <Roll value={shownValue === null ? '–' : String(shownValue)} className={styles.readoutValue} />
              <span className={`${styles.readoutSide} ${styles.readoutSideDim}`}>
                <Swap text={readSide} />
              </span>
            </div>
          </div>
          <div className={styles.chartArea} onPointerLeave={() => setActive(null)}>
            <div className={styles.bars}>
              {baselineN !== null && (
                <div className={styles.baseline} style={{ bottom: pct(baselineN) }}>
                  <span className={styles.baselineTag}>평소 {Math.round(baselineN)}</span>
                </div>
              )}
              {days.map((d, i) => {
                const value = d.stress === null ? null : Math.round(d.stress)
                return (
                  <div
                    key={d.date}
                    className={`${styles.barCol} ${active === i ? styles.barColOn : ''}`}
                    aria-label={`${axisLabel(d.date, d.isToday)} 스트레스 ${value ?? '없음'}`}
                    onPointerEnter={() => setActive(i)}
                  >
                    {value !== null ? (
                      <div className={`${styles.bar} ${d.isToday ? styles.barToday : ''}`} style={{ height: pct(value) }} />
                    ) : (
                      <span className={styles.barNone}>–</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className={styles.axis}>
            {days.map((d, i) => (
              <span key={d.date} className={d.isToday ? styles.axisToday : undefined}>
                {d.isToday || i % 3 === 1 ? axisLabel(d.date, d.isToday) : ''}
              </span>
            ))}
          </div>
        </div>

        <div className={`${styles.frame} ${styles.callsFrame}`}>
          <span className={styles.panelTitle}>
            오늘 측정 {today.sessions.length}회 · {mmss(storedSec)}
          </span>
          {rows.length === 0 ? (
            <p className={styles.verdictSub}>오늘 저장된 측정이 없습니다</p>
          ) : (
            <ul className={styles.calls}>
              {rows.map((c) => (
                <li key={c.key} className={styles.call}>
                  <span>{c.time}</span>
                  <span className={styles.callDim}>{mmss(c.durationSec)}</span>
                  <span>
                    {c.emotion ? (
                      <>
                        <i className={styles.swatch} style={{ background: swatchColor(c.emotion, light) }} aria-hidden="true" />
                        {EMOTION_LABELS[c.emotion]}
                      </>
                    ) : (
                      '–'
                    )}
                  </span>
                  <span className={styles.callDim}>{c.note}</span>
                  {c.href ? (
                    <Link href={c.href} className={`${styles.callLink} ${styles.focusable}`}>
                      결과 보기
                    </Link>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`${styles.right} ${styles.rightScroll}`}>
        <div className={styles.head}>
          <div className={styles.verdictBox}>
            <span className={styles.chip}>
              {baseline.mode === 'relative' ? `${BASELINE_WINDOW_DAYS}일 기준선 대비` : '기록 3일 미만 · 절대 기준'}
            </span>
            <p className={styles.verdict}>{verdict}</p>
            <p className={styles.verdictSub}>{sub}</p>
          </div>
          <DotOrb getPulse={NO_PULSE} emotion={dominant ?? 'calm'} scheme={theme} size={112} />
        </div>

        <CheckInDemo />

        <div className={styles.stats}>
          <Stat k="긍정" v={today.scores ? String(Math.round(today.scores.positive)) : '–'} />
          <Stat k="측정" v={String(today.sessions.length)} unit="회" />
          <Stat k="저장 기록" v={String(Math.round(storedSec / 60))} unit="분" />
        </div>

        <div className={styles.rows}>
          <Row k="힘들었던 시간대" v={hardestText} />
          <Row
            k="감정 비율"
            v={today.shares ? SHARE_ORDER.map((e) => `${EMOTION_LABELS[e]} ${Math.round(today.shares![e] * 100)}`).join(' · ') : '–'}
          />
          <Row k="기준선" v={baseline.mode === 'relative' ? `최근 ${BASELINE_WINDOW_DAYS}일 중 ${stored.validDays}일` : '기록 3일 미만 · 절대 기준'} />
          <Row k="심박" v="저장하지 않음 · 측정 결과 화면에서 확인" />
        </div>

        <CareCard moment="day" onBreathe={setBreathing} title="쉬는 시간·퇴근 후" level={today.level} mode={baseline.mode} />

        <div className={styles.actions} style={{ marginTop: 'auto' }}>
          <Link href={MEASURE_HREF} className={`${styles.btnSolid} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            측정 시작
          </Link>
          <Link href="/demo/records" className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            기록 보기
          </Link>
        </div>
      </div>
      {breathing && <BreathingGuide plan={breathing} onClose={() => setBreathing(null)} />}
    </div>
  )
}

function todayLabel(stored: StoredOverview): string {
  const [y, m, d] = stored.history[stored.history.length - 1].date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

/** 축 라벨. 오늘은 글자로, 나머지는 월/일. */
function axisLabel(dateKey: string, isToday: boolean): string {
  if (isToday) return '오늘'
  const [, m, d] = dateKey.split('-')
  return `${Number(m)}/${Number(d)}`
}
