'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { EMOTION_LABELS, EMOTION_ORDER } from '@/features/algorithm/emotion/emotionAnalysis'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import CallChart, { type ScrubReason } from './CallChart'
import { mmss, Row, Stat, swatchColor, usePulseAt } from './demoBits'
import { LEGAL } from './demoCopy'
import { bpmText, NO_PULSE } from './heartRate'
import { cleanBpmSeries } from '@/features/rppg/lib/bpmCleaning'
import styles from './measureDemo.module.css'
import DotOrb from './orbs/DotOrb'
import { Roll, Swap } from './Roll'
import { peakWithEmotion, smoothBpm, sourceShareText, summarizeSession, type DemoSession } from './sessionLog'
import { useStoredOverview } from './useStoredOverview'
import { useStoredSession } from './useStoredSession'

/**
 * 측정이 끝난 뒤 나오는 결과 화면 데모. 측정 화면과 같은 틀.
 * 왼쪽은 한 단계 밝은 면 위의 측정 차트. 위쪽 큰 숫자가 읽어 주는 값이고, 차트를 훑으면 그 순간의 값으로 굴러 바뀐다.
 * 오른쪽은 이번 측정의 감정 요약, 숫자 둘, 행, 버튼. 같은 정보는 한 곳에서만 말한다.
 * 측정 화면이 넘긴 이번 측정만 보여준다. 넘겨받은 기록이 없으면 표본으로 채우지 않고 "기록 없음"을 보여준다.
 * 이번 측정에 대한 스트레스 판정은 하지 않는다(하루 판정은 리포트가 저장된 기록으로 한다).
 * 심박은 선택된 원천의 기록을 쓰고, 유효한 기록이 없으면 "--"를 표시한다.
 */

const MEASURE_HREF = '/demo/measure'
const REPORT_HREF = '/demo/report'
const HERO_HREF = DEMO_HOME_HREF

export default function ResultDemo() {
  const [theme, toggleTheme] = useDemoTheme()
  const session = useStoredSession()

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.readable}`} data-theme={theme}>
      <nav className={styles.nav}>
        <Link href={HERO_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono}`}>{session ? `측정 종료 ${mmss(session.durationSec)}` : '측정 결과'}</span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          {session ? '다시 측정' : '측정 시작'}
        </Link>
      </nav>

      {session ? <SessionResult session={session} theme={theme} /> : <NoSession />}
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

/** 넘겨받은 측정이 없을 때(결과 화면을 바로 열었거나 탭을 새로 열었을 때). */
function NoSession() {
  return (
    <div className={styles.body}>
      <div className={styles.panel}>
        <div className={styles.readout}>
          <span className={styles.readoutLabel}>이번 측정</span>
          <div className={styles.readoutMain}>
            <span className={styles.readoutValue}>–</span>
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.head}>
          <div className={styles.verdictBox}>
            <span className={styles.chip}>측정 결과</span>
            <p className={styles.verdict}>아직 이 화면에서 끝낸 측정이 없습니다</p>
            <p className={styles.verdictSub}>측정을 시작하고 끝내면 이번 측정의 감정 흐름이 여기에 나옵니다.</p>
          </div>
        </div>
        <div className={styles.actions} style={{ marginTop: 'auto' }}>
          <Link href={MEASURE_HREF} className={`${styles.btnSolid} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            측정 시작
          </Link>
          <Link href={REPORT_HREF} className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            리포트 보기
          </Link>
        </div>
      </div>
    </div>
  )
}

function SessionResult({ session, theme }: { session: DemoSession; theme: 'dark' | 'light' }) {
  const light = theme === 'light'
  const stored = useStoredOverview()
  const [active, setActive] = useState<number | null>(null)
  const [reason, setReason] = useState<ScrubReason>('pointer')
  const onScrub = useCallback((index: number | null, why: ScrubReason = 'pointer') => {
    setActive(index)
    setReason(why)
  }, [])

  const summary = useMemo(() => summarizeSession(session), [session])
  const smooth = useMemo(() => smoothBpm(cleanBpmSeries(session.samples).map((s) => s.bpm), session.samples), [session])
  // 요약은 사후 정리한 실제 선택값을 쓰고 그래프 이동평균과 구분한다.
  const maxBpm = summary.maxBpm
  const peak = useMemo(() => peakWithEmotion(session, summary), [summary, session])
  const pulseAtAvg = usePulseAt(summary.avgBpm ?? 60)
  const getPulse = summary.avgBpm === null ? NO_PULSE : pulseAtAvg

  // 위쪽 큰 숫자: 평소엔 측정 평균, 차트를 훑는 동안엔 그 순간
  const point = active !== null ? session.samples[active] : null
  const readLabel = point ? (reason === 'camera' ? `심박이 가장 높은 순간 · ${mmss(point.t)}` : mmss(point.t)) : '측정 평균 심박'
  const readBpm = point ? smooth[active!] : summary.avgBpm
  const readEmotion = point ? point.emotion : summary.dominant

  const detectedPct = Math.round(summary.detectedRatio * 100)
  const verdict = summary.dominant ? `${EMOTION_LABELS[summary.dominant]}이 가장 오래 머물렀습니다` : '얼굴을 찾지 못해 감정 기록이 없습니다'
  const shareText = summary.dominant
    ? EMOTION_ORDER.filter((e) => summary.shares[e] > 0)
        .sort((a, b) => summary.shares[b] - summary.shares[a])
        .map((e) => `${EMOTION_LABELS[e]} ${Math.round(summary.shares[e] * 100)}`)
        .join(' · ')
    : '–'
  const todayText =
    stored === null
      ? '읽는 중'
      : stored.today.scores
        ? `긍정 ${Math.round(stored.today.scores.positive)} · 스트레스 ${Math.round(stored.today.stress ?? stored.today.scores.stress)}`
        : '저장된 기록 없음'

  return (
    <div className={styles.body}>
      <div className={styles.panel}>
        <div className={styles.readout}>
          <Swap text={readLabel} className={styles.readoutLabel} />
          <div className={styles.readoutMain}>
            <Roll value={bpmText(readBpm)} className={styles.readoutValue} />
            <span className={styles.readoutUnit}>BPM</span>
            <span className={styles.readoutSide}>
              {readEmotion ? (
                <>
                  <i style={{ background: swatchColor(readEmotion, light) }} aria-hidden="true" />
                  <Swap text={EMOTION_LABELS[readEmotion]} />
                </>
              ) : (
                <Swap text="얼굴 못 찾음" />
              )}
            </span>
          </div>
        </div>
        <CallChart
          points={session.samples}
          smooth={smooth}
          durationSec={session.durationSec}
          highlight={peak}
          shares={summary.shares}
          missing={1 - summary.detectedRatio}
          scheme={theme}
          active={active}
          onScrub={onScrub}
        />
      </div>

      <div className={styles.right}>
        <div className={styles.head}>
          <div className={styles.verdictBox}>
            <span className={styles.chip}>이번 측정</span>
            <p className={styles.verdict}>{verdict}</p>
            <p className={styles.verdictSub}>측정 시간 중 얼굴을 찾은 시간 {detectedPct}%</p>
          </div>
          <DotOrb
            getPulse={getPulse}
            emotion={summary.dominant ?? 'calm'}
            bpm={summary.avgBpm ?? undefined}
            scheme={theme}
            size={112}
          />
        </div>

        <div className={`${styles.stats} ${styles.stats2}`}>
          <Stat k="측정 시간" v={mmss(session.durationSec)} />
          <Stat k="최고 심박" v={bpmText(maxBpm)} unit="BPM" />
        </div>

        <div className={styles.rows}>
          <Row k="감정 비율" v={shareText} />
          <Row k="심박" v={summary.avgBpm === null ? '심박 기록 없음' : `평균 ${summary.avgBpm} BPM`} />
          <Row k="심박 출처" v={sourceShareText(summary.sourceShares)} />
          <Row k="오늘" v={todayText} />
        </div>

        <div className={styles.actions} style={{ marginTop: 'auto' }}>
          <Link href={MEASURE_HREF} className={`${styles.btnSolid} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            다시 측정
          </Link>
          <Link href={REPORT_HREF} className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            리포트 보기
          </Link>
        </div>
      </div>
    </div>
  )
}
