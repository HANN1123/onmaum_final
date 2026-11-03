'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { EMOTION_LABELS, type Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { LEGAL, SAMPLE_TODAY } from './demoCopy'
import styles from './measureDemo.module.css'
import DotOrb from './orbs/DotOrb'
import { mixRgb, ORB_PALETTE, rgba, type Rgb } from './orbs/emotionPalette'
import { LEVEL_COPY, LEVEL_SHORT, makeSampleSession, summarizeSession } from './sessionLog'
import TimelineCanvas from './TimelineCanvas'
import { formatElapsed } from './useSimulatedVitals'
import { useStoredSession } from './useStoredSession'

/**
 * 통화가 끝난 뒤 나오는 결과 화면 데모. 측정 화면과 같은 틀(상단·좌우 분할·모노 행·각진 상자).
 * 왼쪽은 통화 타임라인(감정색 띠 + 심박 선)과 감정 비율, 오른쪽은 판정 한 줄·숫자 셋·오늘 누적·자기보고·버튼.
 * 측정 화면이 넘긴 기록이 없으면 표본 통화를 보여준다. 판정 문구·기준선·오늘 누적은 표본이다.
 */

const MEASURE_HREF = '/demo/measure'
const HERO_HREF = '/demo/hero-dark'
const EMOTION_ORDER: Emotion[] = ['calm', 'happy', 'sad', 'angry']
const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]
/** 넘겨받은 통화가 없을 때 보여줄 표본. 결정적이라 서버와 클라이언트가 같은 그림을 그린다. */
const SAMPLE_SESSION = makeSampleSession()

type SelfReport = 'agree' | 'worse' | 'better'
/** 자기보고 선택지. 기준선 보정 입력(algorithm/baseline 의 SelfReport)과 같은 셋이다. 데모에선 저장하지 않는다. */
const SELF_REPORT: { key: SelfReport; label: string }[] = [
  { key: 'agree', label: '맞음' },
  { key: 'worse', label: '더 힘듦' },
  { key: 'better', label: '더 괜찮음' },
]

export default function ResultDemo() {
  const [theme, toggleTheme] = useDemoTheme()
  const stored = useStoredSession()
  const session = stored ?? SAMPLE_SESSION
  const [report, setReport] = useState<SelfReport | null>(null)

  const summary = useMemo(() => summarizeSession(session), [session])
  const light = theme === 'light'
  const paper = light ? WHITE : BLACK
  const durationText = formatElapsed(session.durationSec)
  const highlight = summary.hardest ? { start: summary.hardest.start, end: summary.hardest.end } : null
  const needsRest = summary.level === 'high' || summary.level === 'veryHigh'

  // 오브는 통화의 우세 감정색으로, 평균 심박 빠르기로 두근거린다.
  const avgBpm = summary.avgBpm
  const getPulse = useCallback(() => {
    const phase = ((performance.now() / 1000) * (avgBpm / 60)) % 1
    const systolic = Math.exp(-(((phase - 0.16) / 0.06) ** 2))
    const dicrotic = 0.32 * Math.exp(-(((phase - 0.44) / 0.1) ** 2))
    return Math.min(1, systolic + dicrotic)
  }, [avgBpm])

  const sub = summary.hardest
    ? `가장 힘들었던 구간은 ${mmss(summary.hardest.start)}–${mmss(summary.hardest.end)}, 그때 심박이 ${summary.hardest.peakBpm}까지 올랐습니다.`
    : '통화가 짧아 구간을 나누지 않았습니다.'
  const hardLeft = summary.hardest
    ? Math.min(88, Math.max(12, (((summary.hardest.start + summary.hardest.end) / 2) / session.durationSec) * 100))
    : 0

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell}`} data-theme={theme}>
      <nav className={styles.nav}>
        <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono}`}>통화 종료 {durationText}</span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          다음 통화
        </Link>
      </nav>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={`${styles.frame} ${styles.resultFrame}`}>
            <div className={styles.timelineWrap}>
              <TimelineCanvas
                points={session.samples}
                durationSec={session.durationSec}
                highlight={highlight}
                scheme={theme}
                className={styles.timeline}
              />
              {summary.hardest && (
                <span className={styles.hardLabel} style={{ left: `${hardLeft}%` }}>
                  가장 힘들었던 구간 · {mmss(summary.hardest.start)}–{mmss(summary.hardest.end)}
                </span>
              )}
              <span className={styles.frameTag}>통화 타임라인 · 띠는 감정, 선은 심박</span>
            </div>
            <div className={styles.ticks}>
              <span>00:00</span>
              <span>{mmss(session.durationSec / 2)}</span>
              <span>{mmss(session.durationSec)}</span>
            </div>
          </div>
          <div className={styles.waveBox}>
            <div className={styles.shares}>
              {EMOTION_ORDER.filter((e) => summary.shares[e] > 0).map((e) => (
                <div
                  key={e}
                  className={styles.share}
                  style={{ flex: summary.shares[e], background: rgba(mixRgb(paper, ORB_PALETTE[e].base, light ? 0.42 : 0.5), 1) }}
                >
                  {summary.shares[e] >= 0.1 && (
                    <span className={styles.shareLabel}>
                      {EMOTION_LABELS[e]} {Math.round(summary.shares[e] * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            <span className={styles.frameTag}>통화 중 감정 비율</span>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.head}>
            <div className={styles.verdictBox}>
              <span className={styles.chip}>[ 통화 종료 · 14일 기준선 대비 ]</span>
              <p className={styles.verdict}>{LEVEL_COPY[summary.level]}</p>
              <p className={styles.verdictSub}>{sub}</p>
            </div>
            <DotOrb getPulse={getPulse} emotion={summary.dominant} bpm={avgBpm} scheme={theme} size={112} />
          </div>

          <div className={styles.stats}>
            <Stat k="통화 시간" v={mmss(session.durationSec)} />
            <Stat k="평균 심박" v={String(summary.avgBpm)} unit="BPM" />
            <Stat k="최고 심박" v={String(summary.maxBpm)} unit="BPM" />
          </div>

          <div className={styles.rows}>
            <Row k="우세 감정" v={EMOTION_LABELS[summary.dominant]} />
            <Row k="이번 통화" v={LEVEL_SHORT[summary.level]} />
            <Row k="오늘" v={`긍정 ${SAMPLE_TODAY.positive} · 스트레스 ${SAMPLE_TODAY.stress} · 통화 ${SAMPLE_TODAY.calls}건`} />
            {needsRest && <Row k="권장" v="다음 통화 전 2분 휴식" />}
            <div className={styles.row}>
              <span className={styles.k}>자기보고</span>
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
            <Link href="/stats" className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
              리포트 보기
            </Link>
          </div>
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

/** 초 → 07:12. 결과 화면의 짧은 표기. 상단은 측정 화면과 같은 00:07:12 를 쓴다. */
function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function Stat({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statK}>{k}</span>
      <span className={styles.statV}>
        {v}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.k}>{k}</span>
      <span>{v}</span>
    </div>
  )
}
