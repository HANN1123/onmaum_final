'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { BASELINE_WINDOW_DAYS } from '@/features/algorithm/baseline/baseline'
import { jetbrainsMono, sora } from '@/features/ui/landing/hero-demo/fonts'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'
import { useDemoTheme } from '@/features/ui/landing/hero-demo/useDemoTheme'
import { downloadJson, importErrorText, importResultText } from '@/features/ui/records/DataManagement'
import {
  deleteAllPersonalData,
  exportPersonalData,
  MeasurementActiveError,
  serializeExport,
} from '@/shared/storage/personalData'
import { importPersonalData, ImportFormatError, MAX_IMPORT_BYTES, parsePersonalDataImport } from '@/shared/storage/personalImport'
import { Row, Stat } from './demoBits'
import { LEGAL } from './demoCopy'
import styles from './measureDemo.module.css'
import { Roll, Swap } from './Roll'
import { levelShort, type StoredDay, type StoredOverview } from './storedOverview'
import { useStoredOverview } from './useStoredOverview'

/**
 * 기록 화면 데모. 측정·결과·리포트와 같은 틀.
 * 왼쪽은 지난 14일. 한 줄이 하루이고, 막대는 그날 스트레스, 세로 눈금은 평소다. 줄을 훑으면 위쪽 큰 숫자가 그날을 읽는다.
 * 오른쪽은 내 기록 관리(내보내기·가져오기·지우기). 기존 기록 화면(/records)과 같은 저장 함수를 불러 실제로 동작한다.
 * 날마다의 숫자·판정은 이 기기에 저장된 실제 기록을 algorithm 의 기존 함수로 계산한다(storedOverview).
 */

const MEASURE_HREF = '/demo/measure'
const REPORT_HREF = '/demo/report'
const HERO_HREF = DEMO_HOME_HREF

export default function RecordsDemo() {
  const [theme, toggleTheme] = useDemoTheme()
  const stored = useStoredOverview()

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
          측정 시작
        </Link>
      </nav>

      <div className={styles.body}>
        {stored ? <DayPanel stored={stored} /> : <div className={`${styles.panel} ${styles.recordsPanel}`} />}
        <div className={styles.right}>
          <div className={styles.head}>
            <div className={styles.verdictBox}>
              <span className={styles.chip}>내 기록 관리</span>
              <p className={styles.verdict}>기록은 이 기기 안에만 있습니다</p>
              <p className={styles.verdictSub}>파일로 내보내 다른 기기로 옮기거나, 한 번에 지울 수 있습니다. 영상은 처음부터 저장하지 않습니다.</p>
            </div>
          </div>
          {stored && <Totals stored={stored} />}
          <Manage />
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

function DayPanel({ stored }: { stored: StoredOverview }) {
  const { baseline } = stored
  const baselineN = baseline.baselineN
  // 최근 날이 위로
  const days = useMemo(() => stored.days.slice().reverse(), [stored.days])
  const [selected, setSelected] = useState<number | null>(null)
  const shown = days[selected ?? 0]
  const shownStress = shown.stress === null ? null : Math.round(shown.stress)
  const diff = shownStress !== null && baselineN !== null ? shownStress - Math.round(baselineN) : null
  const readSide =
    shownStress === null ? '측정 없음' : diff === null ? '' : diff === 0 ? '평소와 같음' : `평소보다 ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`
  const readLabel = `${dayLabel(shown.date)}${shown.isToday ? ' · 오늘' : ''}`
  const readSub = shown.minutes > 0 ? dayAmount(shown) : '이날은 측정하지 않았습니다'

  const scaleMax = useMemo(() => {
    const max = days.reduce((m, d) => Math.max(m, d.stress ?? 0), baselineN ?? 0)
    return Math.max(40, Math.ceil((max * 1.25) / 10) * 10)
  }, [days, baselineN])
  const pct = (v: number) => `${(v / scaleMax) * 100}%`

  return (
    <div className={`${styles.panel} ${styles.recordsPanel}`}>
      <div className={styles.readout}>
        <Swap text={readLabel} className={styles.readoutLabel} />
        <div className={styles.readoutMain}>
          <Roll value={shownStress === null ? '–' : String(shownStress)} className={styles.readoutValue} />
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
              {dayLabel(d.date)}
              {d.isToday && <em>오늘</em>}
            </span>
            <span className={styles.dayCalls}>{d.minutes > 0 ? dayAmount(d) : '–'}</span>
            <span className={styles.dayTrack} aria-hidden="true">
              {d.stress !== null && <i className={styles.dayFill} style={{ width: pct(d.stress) }} />}
              {baselineN !== null && <b className={styles.dayBase} style={{ left: pct(baselineN) }} />}
            </span>
            <span className={styles.dayLevel}>{d.level ? levelShort(d.level, baseline) : '측정 없음'}</span>
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
  )
}

function Totals({ stored }: { stored: StoredOverview }) {
  const recorded = stored.days.filter((d) => d.stress !== null).length
  const sessions = stored.days.reduce((sum, d) => sum + d.sessions, 0)
  const minutes = stored.days.reduce((sum, d) => sum + d.minutes, 0)
  const last = stored.today.sessions[0]
  return (
    <>
      <div className={styles.stats}>
        <Stat k="기록한 날" v={String(recorded)} unit="일" />
        <Stat k="측정" v={String(sessions)} unit="회" />
        <Stat k="측정 시간" v={String(Math.floor(minutes / 60))} unit={`시간 ${minutes % 60}분`} />
      </div>
      <div className={styles.rows}>
        <Row k="저장 위치" v="이 기기 · 브라우저 저장소" />
        <Row k="오늘 마지막 측정" v={last ? last.startedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '없음'} />
      </div>
    </>
  )
}

/** 내 기록 관리. 기존 기록 화면(DataManagement)과 같은 저장 함수·문구를 쓴다. */
function Manage() {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [alsoSettings, setAlsoSettings] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setBusy(true)
    try {
      const data = await exportPersonalData()
      const date = new Date().toLocaleDateString('en-CA')
      downloadJson(serializeExport(data), `onmaum-records-${date}.json`)
      setNotice(`기록 ${data.emotions.length}개로 파일 다운로드를 시작했어요. 다운로드 폴더에서 확인해 주세요`)
    } catch {
      setNotice('파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new ImportFormatError('tooLarge')
      const summary = await importPersonalData(parsePersonalDataImport(await file.text()))
      setNotice(importResultText(summary))
    } catch (err) {
      setNotice(importErrorText(err))
    } finally {
      setBusy(false)
      // 같은 파일을 다시 골라도 change 가 일어나도록 비운다
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await deleteAllPersonalData({ includePreferences: alsoSettings })
      setConfirming(false)
      setAlsoSettings(false)
      setNotice('모든 기록을 지웠어요')
    } catch (err) {
      setNotice(
        err instanceof MeasurementActiveError
          ? '측정이 진행 중이에요. 다른 탭이나 창의 측정을 멈추고 2분 뒤에 다시 시도해 주세요'
          : '일부 기록을 지우지 못했어요. 앱을 새로 고친 뒤 다시 시도해 주세요',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.manage}>
      {confirming ? (
        <div className={styles.confirm} role="group" aria-label="모든 기록 지우기 확인">
          <p>측정 기록, 체크인과 알림 기록을 모두 지웁니다. 지운 기록은 되돌릴 수 없습니다.</p>
          <label className={styles.check}>
            <input type="checkbox" checked={alsoSettings} onChange={(e) => setAlsoSettings(e.target.checked)} />
            알림 설정과 처음 설문 답변도 함께 지우기
          </label>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btnGhost} ${styles.focusable}`} onClick={() => setConfirming(false)} disabled={busy}>
              취소
            </button>
            <button type="button" className={`${styles.btnDanger} ${styles.focusable}`} onClick={handleDelete} disabled={busy}>
              지우기
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={handleExport} disabled={busy}>
              파일로 내보내기
            </button>
            <button
              type="button"
              className={`${styles.btnGhost} ${styles.focusable}`}
              onClick={() => {
                setNotice(null)
                fileInputRef.current?.click()
              }}
              disabled={busy}
            >
              파일 가져오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </div>
          <button type="button" className={`${styles.textDanger} ${styles.focusable}`} onClick={() => setConfirming(true)} disabled={busy}>
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
  )
}

/** "측정 3회 · 45분". 세션이 없던 예전 기록은 시간만 */
function dayAmount(d: StoredDay): string {
  return d.sessions > 0 ? `측정 ${d.sessions}회 · ${d.minutes}분` : `${d.minutes}분`
}

/** 11/3 (화) */
function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).toLocaleDateString('ko-KR', { weekday: 'short' })
  return `${m}/${d} (${weekday})`
}
