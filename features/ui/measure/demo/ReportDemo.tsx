'use client'

import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { classifyStress, computeBaselineState, BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { EMOTION_LABELS, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { PERIOD_BUCKET_HOURS } from '@/features/algorithm/stress/dailyStress'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { mmss, Row, Stat, swatchColor, usePulseAt } from './demoBits'
import { LEGAL, SAMPLE_TODAY } from './demoCopy'
import styles from './measureDemo.module.css'
import DotOrb from './orbs/DotOrb'
import { Roll, Swap } from './Roll'
import {
  DAY_LEVEL_COPY,
  formatClock,
  SAMPLE_AVG_BPM,
  SAMPLE_SHARES,
  sampleCalls,
  sampleHardestHour,
  sampleHistory,
  type SampleCall,
} from './reportSamples'
import { LEVEL_SHORT, summarizeSession } from './sessionLog'
import { useStoredSession } from './useStoredSession'

/**
 * 하루 리포트 화면 데모. 측정·결과 화면과 같은 틀.
 * 14일 막대 위의 큰 숫자가 읽어 주는 값이다. 막대를 훑으면 그날의 스트레스와 평소와의 차이로 굴러 바뀐다(Stageshow 의 차트 스크럽).
 * 왼쪽은 14일 스트레스 막대(점선이 평소)와 오늘 통화 목록, 오른쪽은 하루 판정·숫자 셋·행·버튼.
 * 숫자는 표본이지만 "평소" 기준선과 판정은 algorithm/baseline 의 실제 함수로 계산한다.
 * 방금 끝낸 통화가 있으면 목록 맨 위에 올리고 결과 화면으로 잇는다.
 */

const MEASURE_HREF = '/demo/measure'
const RESULT_HREF = '/demo/result'
const HERO_HREF = '/demo/hero-dark'
const SHARE_ORDER: Emotion[] = ['calm', 'happy', 'sad', 'angry']

/** 분 단위의 지금. 서버에서는 0 이라 날짜·시각 글자가 어긋나지 않고, 하이드레이션 뒤 한 번 채워진다. */
const subscribe = () => () => {}
const readMinute = () => Math.floor(Date.now() / 60000)
const serverMinute = () => 0

interface CallRow extends SampleCall {
  href?: string
  recent?: boolean
}

export default function ReportDemo() {
  const [theme, toggleTheme] = useDemoTheme()
  const light = theme === 'light'
  const minute = useSyncExternalStore(subscribe, readMinute, serverMinute)
  const now = useMemo(() => (minute ? new Date(minute * 60000) : null), [minute])
  const history = useMemo(() => sampleHistory(now ?? new Date(0)), [now])

  // 기준선과 판정은 실제 알고리즘. 오늘(마지막 날)은 기준선에서 빠진다.
  const baseline = useMemo(() => computeBaselineState(history), [history])
  const level = classifyStress(SAMPLE_TODAY.stress, baseline)
  const baselineN = baseline.baselineN
  const validDays = history.slice(0, -1).filter((p) => p.scores !== null).length
  const [active, setActive] = useState<number | null>(null)
  // 막대 눈금 상한: 가장 높은 날의 1.3배를 10 단위로 올림. 평소선도 같은 눈금을 쓴다.
  const scaleMax = useMemo(() => {
    const max = history.reduce((m, p) => Math.max(m, p.scores?.stress ?? 0), baselineN ?? 0)
    return Math.max(40, Math.ceil((max * 1.3) / 10) * 10)
  }, [history, baselineN])
  const pct = (v: number) => `${(v / scaleMax) * 100}%`

  const stored = useStoredSession()
  const calls = useMemo<CallRow[]>(() => {
    const sample = sampleCalls(stored ? new Date(stored.endedAt) : (now ?? new Date(0)))
    if (!stored) return sample
    const summary = summarizeSession(stored)
    const recent: CallRow = {
      time: formatClock(new Date(stored.endedAt)),
      durationSec: stored.durationSec,
      level: summary.level,
      emotion: summary.dominant,
      href: RESULT_HREF,
      recent: true,
    }
    return [recent, ...sample]
  }, [stored, now])
  const totalSec = calls.reduce((sum, c) => sum + c.durationSec, 0)
  const heavyCalls = calls.filter((c) => c.level === 'high' || c.level === 'veryHigh').length

  const dominant = SHARE_ORDER.reduce((a, b) => (SAMPLE_SHARES[b] > SAMPLE_SHARES[a] ? b : a))
  const getPulse = usePulseAt(SAMPLE_AVG_BPM)
  const dateLabel = now ? now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) : ''
  const hardestHour = sampleHardestHour(now ?? new Date(0))
  const hardestText = `${hardestHour}–${hardestHour + PERIOD_BUCKET_HOURS}시`
  const sub = `통화 ${calls.length}건 중 ${heavyCalls}건이 평소보다 무거웠습니다.`

  // 위쪽 큰 숫자: 평소엔 오늘, 막대를 훑는 동안엔 그날
  const todayIndex = history.length - 1
  const shown = active ?? todayIndex
  const shownDay = history[shown]
  const shownValue = shownDay.scores ? Math.round(shownDay.scores.stress) : null
  const readLabel = shown === todayIndex ? '오늘 스트레스' : `${axisLabel(shownDay.date, false, now)} 스트레스`
  const diff = shownValue !== null && baselineN !== null ? shownValue - Math.round(baselineN) : null
  const readSide =
    shownValue === null ? '측정 없음' : diff === null ? '' : diff === 0 ? '평소와 같음' : `평소보다 ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.readable}`} data-theme={theme}>
      <nav className={styles.nav}>
        <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono}`}>오늘 {dateLabel}</span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          다음 통화
        </Link>
      </nav>

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
                {history.map((p, i) => {
                  const isToday = i === history.length - 1
                  const value = p.scores ? Math.round(p.scores.stress) : null
                  return (
                    <div
                      key={p.date}
                      className={`${styles.barCol} ${active === i ? styles.barColOn : ''}`}
                      aria-label={`${axisLabel(p.date, isToday, now)} 스트레스 ${value ?? '없음'}`}
                      onPointerEnter={() => setActive(i)}
                    >
                      {value !== null ? (
                        <div className={`${styles.bar} ${isToday ? styles.barToday : ''}`} style={{ height: pct(value) }} />
                      ) : (
                        <span className={styles.barNone}>–</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className={styles.axis}>
              {history.map((p, i) => {
                const isToday = i === history.length - 1
                const show = isToday || i % 3 === 1
                return (
                  <span key={p.date} className={isToday ? styles.axisToday : undefined}>
                    {show ? axisLabel(p.date, isToday, now) : ''}
                  </span>
                )
              })}
            </div>
          </div>

          <div className={`${styles.frame} ${styles.callsFrame}`}>
            <span className={styles.panelTitle}>오늘 통화 {calls.length}건 · {mmss(totalSec)}</span>
            <ul className={styles.calls}>
              {calls.map((c, i) => (
                <li key={`${c.time}-${i}`} className={styles.call}>
                  <span>{c.time}</span>
                  <span className={styles.callDim}>{mmss(c.durationSec)}</span>
                  <span>
                    <i className={styles.swatch} style={{ background: swatchColor(c.emotion, light) }} aria-hidden="true" />
                    {EMOTION_LABELS[c.emotion]}
                  </span>
                  <span className={styles.callDim}>{LEVEL_SHORT[c.level]}</span>
                  {c.href ? (
                    <Link href={c.href} className={`${styles.callLink} ${styles.focusable}`}>
                      {c.recent ? '방금 · 결과 보기' : '결과 보기'}
                    </Link>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.head}>
            <div className={styles.verdictBox}>
              <span className={styles.chip}>{BASELINE_WINDOW_DAYS}일 기준선 대비</span>
              <p className={styles.verdict}>{DAY_LEVEL_COPY[level]}</p>
              <p className={styles.verdictSub}>{sub}</p>
            </div>
            <DotOrb getPulse={getPulse} emotion={dominant} bpm={SAMPLE_AVG_BPM} scheme={theme} size={112} />
          </div>

          <div className={styles.stats}>
            <Stat k="긍정" v={String(SAMPLE_TODAY.positive)} />
            <Stat k="통화" v={String(calls.length)} unit="건" />
            <Stat k="평균 심박" v={String(SAMPLE_AVG_BPM)} unit="BPM" />
          </div>

          <div className={styles.rows}>
            <Row k="힘들었던 시간대" v={hardestText} />
            <Row k="감정 비율" v={SHARE_ORDER.map((e) => `${EMOTION_LABELS[e]} ${SAMPLE_SHARES[e]}`).join(' · ')} />
            <Row k="기준선" v={baseline.mode === 'relative' ? `최근 ${BASELINE_WINDOW_DAYS}일 중 ${validDays}일` : '기록 3일 미만 · 절대 기준'} />
          </div>

          <div className={styles.actions} style={{ marginTop: 'auto' }}>
            <Link href={MEASURE_HREF} className={`${styles.btnSolid} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
              다음 통화
            </Link>
            <Link href="/demo/records" className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
              기록 보기
            </Link>
          </div>
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

/** 축 라벨. 오늘은 글자로, 나머지는 월/일. 서버에서는 날짜를 모르므로 빈 글자. */
function axisLabel(dateKey: string, isToday: boolean, today: Date | null): string {
  if (isToday) return '오늘'
  if (!today) return ''
  const [, m, d] = dateKey.split('-')
  return `${Number(m)}/${Number(d)}`
}
