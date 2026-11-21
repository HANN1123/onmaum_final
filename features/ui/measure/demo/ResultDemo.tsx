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
import { themeMenuItem } from './menuItems'
import NavMenu from './NavMenu'
import { bpmText, NO_PULSE } from './heartRate'
import { cleanBpmSeries } from '@/features/rppg/lib/bpmCleaning'
import styles from './measureDemo.module.css'
import DotOrb from './orbs/DotOrb'
import { Roll, Swap } from './Roll'
import { peakWithEmotion, sessionStressLevel, smoothBpm, summarizeSession, type DemoSession } from './sessionLog'
import StressGauge from './StressGauge'
import { loadSettings } from '@/shared/storage/settings'
import { useStoredOverview } from './useStoredOverview'
import { useStoredSession } from './useStoredSession'
import BreathingGuide from './BreathingGuide'
import CareCard from './CareCard'
import type { BreathingPlan } from '@/features/feedback/lib/careActions'

/**
 * 측정이 끝난 뒤 나오는 결과 화면 데모. 측정 화면과 같은 틀.
 * 왼쪽은 한 단계 밝은 면 위의 측정 차트. 위쪽 큰 숫자가 읽어 주는 값이고, 차트를 훑으면 그 순간의 값으로 굴러 바뀐다.
 * 오른쪽은 이번 측정의 감정 요약, 숫자 둘, 행, 버튼. 같은 정보는 한 곳에서만 말한다.
 * 측정 화면이 넘긴 이번 측정만 보여준다. 넘겨받은 기록이 없으면 표본으로 채우지 않고 "기록 없음"을 보여준다.
 * 이번 측정에 대한 스트레스 판정은 하지 않는다(하루 판정은 리포트가 저장된 기록으로 한다).
 * 스트레스는 저장된 오늘 기록의 값을 네 칸 게이지(StressGauge)로만 보인다. 14일 값은 리포트에서 본다.
 * 2026-11-20 교수님 피드백으로 심박 출처 행과 긍정 점수를 뺐고(같은 정보가 많음), 측정 시작 버튼은 아래 하나만 둔다.
 * 심박은 선택된 원천의 기록을 쓰고, 유효한 기록이 없으면 "--"를 표시한다.
 * 오른쪽 아래에 처음 설문 답으로 고른 쉬어 가기 제안(CareCard, 측정 직후용)을 하나 보이고, 호흡 제안은 바로 따라 할 수 있다.
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
          {/* 화면 색 바꾸기는 측정 화면처럼 메뉴에 넣는다. 글자가 "화이트"↔"다크"로 바뀌며 폭이 달라져 옆 글자가 움직이던 것을 막는다(2026-11-21) */}
          <NavMenu items={[themeMenuItem(theme, toggleTheme)]} />
        </div>
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
  const [breathing, setBreathing] = useState<BreathingPlan | null>(null)
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

  return (
    <div className={styles.body}>
      <div className={styles.panel}>
        <div className={styles.readout}>
          <Swap text={readLabel} className={styles.readoutLabel} />
          <div className={styles.readoutMain}>
            <Roll value={bpmText(readBpm)} className={styles.readoutValue} />
            <span className={styles.readoutUnit}>bpm</span>
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

      <div className={`${styles.right} ${styles.rightScroll}`}>
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
          <Stat k="최고 심박" v={bpmText(maxBpm)} unit="bpm" />
        </div>

        <div className={styles.rows}>
          <Row k="감정 비율" v={shareText} />
          <Row k="심박" v={summary.avgBpm === null ? '심박 기록 없음' : `평균 ${summary.avgBpm} bpm`} />
        </div>

        <StressGauge
          value={stored?.today.stress ?? null}
          level={stored?.today.level ?? null}
          baseline={stored?.baseline ?? null}
          loading={stored === null}
        />

        <CareCard
          moment="after"
          onBreathe={setBreathing}
          level={stored ? sessionStressLevel(session, stored.baseline, loadSettings().calibrationOffset) : null}
          mode={stored?.baseline.mode ?? 'absolute'}
        />

        <div className={styles.actions} style={{ marginTop: 'auto' }}>
          <Link href={MEASURE_HREF} className={`${styles.btnSolid} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            다시 측정
          </Link>
          <Link href={REPORT_HREF} className={`${styles.btnGhost} ${styles.focusable}`} style={{ textAlign: 'center', textDecoration: 'none' }}>
            리포트 보기
          </Link>
        </div>
      </div>
      {breathing && <BreathingGuide plan={breathing} onClose={() => setBreathing(null)} />}
    </div>
  )
}
