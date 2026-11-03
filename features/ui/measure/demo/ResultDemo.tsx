'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { EMOTION_LABELS, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import CallChart, { type ScrubReason } from './CallChart'
import { mmss, Row, Stat, swatchColor, usePulseAt } from './demoBits'
import { LEGAL, SAMPLE_TODAY } from './demoCopy'
import styles from './measureDemo.module.css'
import DotOrb from './orbs/DotOrb'
import { Roll, Swap } from './Roll'
import { LEVEL_COPY, makeSampleSession, summarizeSession } from './sessionLog'
import { useStoredSession } from './useStoredSession'

/**
 * 통화가 끝난 뒤 나오는 결과 화면 데모. 측정 화면과 같은 틀.
 * 왼쪽은 한 단계 밝은 면 위의 통화 차트. 위쪽 큰 숫자가 읽어 주는 값이고, 차트를 훑으면 그 순간의 심박과 감정으로 굴러 바뀐다.
 * 오른쪽은 판정 한 줄, 숫자 둘, 행, 자기보고, 버튼. 같은 정보는 한 곳에서만 말한다.
 * 측정 화면이 넘긴 기록이 없으면 표본 통화를 보여준다. 판정 문구와 기준선은 표본이다.
 */

const MEASURE_HREF = '/demo/measure'
const REPORT_HREF = '/demo/report'
const HERO_HREF = '/demo/hero-dark'
/** 넘겨받은 통화가 없을 때 보여줄 표본. 결정적이라 서버와 클라이언트가 같은 그림을 그린다. */
const SAMPLE_SESSION = makeSampleSession()

type SelfReport = 'agree' | 'worse' | 'better'
/** 자기보고 선택지. 기준선 보정 입력(algorithm/baseline 의 SelfReport)과 같은 셋이다. 데모에선 저장하지 않는다. */
const SELF_REPORT: { key: SelfReport; label: string }[] = [
  { key: 'agree', label: '맞음' },
  { key: 'worse', label: '더 힘듦' },
  { key: 'better', label: '더 괜찮음' },
]

/** 가운데 정렬 이동 평균. 1초 표본의 잔떨림을 걷어 선을 매끈하게 한다. */
function smoothBpm(values: number[]): number[] {
  const half = values.length > 60 ? 4 : 1
  return values.map((_, i) => {
    let sum = 0
    let n = 0
    for (let k = Math.max(0, i - half); k <= Math.min(values.length - 1, i + half); k += 1) {
      sum += values[k]
      n += 1
    }
    return sum / n
  })
}

export default function ResultDemo() {
  const [theme, toggleTheme] = useDemoTheme()
  const light = theme === 'light'
  const stored = useStoredSession()
  const session = stored ?? SAMPLE_SESSION
  const [report, setReport] = useState<SelfReport | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [reason, setReason] = useState<ScrubReason>('pointer')
  const onScrub = useCallback((index: number | null, why: ScrubReason = 'pointer') => {
    setActive(index)
    setReason(why)
  }, [])

  const summary = useMemo(() => summarizeSession(session), [session])
  const smooth = useMemo(() => smoothBpm(session.samples.map((s) => s.bpm)), [session])
  // 최고 심박은 차트 선과 같은 다듬은 값에서 읽어, 카메라가 읽어 주는 숫자와 어긋나지 않게 한다.
  const maxBpm = useMemo(() => Math.round(Math.max(...smooth)), [smooth])
  // 힘든 구간의 색은 그 구간에서 가장 오래 머문 감정
  const hardest = useMemo(() => {
    if (!summary.hardest) return null
    const { start, end } = summary.hardest
    const count: Record<Emotion, number> = { happy: 0, calm: 0, sad: 0, angry: 0 }
    for (const s of session.samples) if (s.t >= start && s.t <= end) count[s.emotion] += 1
    const emotion = (Object.keys(count) as Emotion[]).reduce((a, b) => (count[b] > count[a] ? b : a))
    return { start, end, emotion }
  }, [summary, session])
  const needsRest = summary.level === 'high' || summary.level === 'veryHigh'
  const getPulse = usePulseAt(summary.avgBpm)

  // 위쪽 큰 숫자: 평소엔 통화 평균, 차트를 훑는 동안엔 그 순간
  const point = active !== null ? session.samples[active] : null
  const readLabel = point ? (reason === 'camera' ? `가장 힘든 순간 · ${mmss(point.t)}` : mmss(point.t)) : '통화 평균'
  const readBpm = point ? Math.round(smooth[active!]) : summary.avgBpm
  const readEmotion = point ? point.emotion : summary.dominant

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.readable}`} data-theme={theme}>
      <nav className={styles.nav}>
        <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono}`}>통화 종료 {mmss(session.durationSec)}</span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          다음 통화
        </Link>
      </nav>

      <div className={styles.body}>
        <div className={styles.panel}>
          <div className={styles.readout}>
            <Swap text={readLabel} className={styles.readoutLabel} />
            <div className={styles.readoutMain}>
              <Roll value={String(readBpm)} className={styles.readoutValue} />
              <span className={styles.readoutUnit}>BPM</span>
              <span className={styles.readoutSide}>
                <i style={{ background: swatchColor(readEmotion, light) }} aria-hidden="true" />
                <Swap text={EMOTION_LABELS[readEmotion]} />
              </span>
            </div>
          </div>
          <CallChart
            points={session.samples}
            smooth={smooth}
            durationSec={session.durationSec}
            hardest={hardest}
            shares={summary.shares}
            scheme={theme}
            active={active}
            onScrub={onScrub}
          />
        </div>

        <div className={styles.right}>
          <div className={styles.head}>
            <div className={styles.verdictBox}>
              <span className={styles.chip}>14일 기준선 대비</span>
              <p className={styles.verdict}>{LEVEL_COPY[summary.level]}</p>
            </div>
            <DotOrb getPulse={getPulse} emotion={summary.dominant} bpm={summary.avgBpm} scheme={theme} size={112} />
          </div>

          <div className={`${styles.stats} ${styles.stats2}`}>
            <Stat k="통화 시간" v={mmss(session.durationSec)} />
            <Stat k="최고 심박" v={String(maxBpm)} unit="BPM" />
          </div>

          <div className={styles.rows}>
            <Row k="오늘" v={`긍정 ${SAMPLE_TODAY.positive} · 스트레스 ${SAMPLE_TODAY.stress} · 통화 ${SAMPLE_TODAY.calls}건`} />
            {needsRest && <Row k="권장" v="다음 통화 전 2분 휴식" />}
            <div className={styles.row}>
              <span className={styles.k}>이 판정이 맞나요</span>
              <span className={styles.presets}>
                {SELF_REPORT.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.preset} ${styles.focusable} ${report === item.key ? styles.presetOn : ''}`}
                    onClick={() => setReport(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className={styles.actions} style={{ marginTop: 'auto' }}>
            <Link href={MEASURE_HREF} className={`${styles.btnSolid} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
              다음 통화
            </Link>
            <Link href={REPORT_HREF} className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
              리포트 보기
            </Link>
          </div>
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}
