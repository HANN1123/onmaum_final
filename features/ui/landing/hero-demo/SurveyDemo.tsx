'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useNotificationPermission } from '@/features/feedback/hooks/useNotificationPermission'
import {
  answeredCount,
  answersFromProfile,
  CARE_SURVEY,
  checkinFromAnswers,
  emptyAnswers,
  profileFromAnswers,
  toggleChoice,
  type SurveyAnswers,
} from '@/features/feedback/lib/careSurvey'
import { LEGAL } from '@/features/ui/measure/demo/demoCopy'
import { nudgeModeOf, withNudgeMode, type NudgeMode } from '@/features/ui/measure/demo/DemoSettings'
import styles from '@/features/ui/measure/demo/measureDemo.module.css'
import { loadConsent, saveConsent } from '@/shared/storage/consent'
import { markOnboarded } from '@/shared/storage/onboarding'
import { loadProfile, saveProfile } from '@/shared/storage/profile'
import { loadSettings, saveSettings } from '@/shared/storage/settings'
import { jetbrainsMono, sora } from './fonts'
import { DEMO_HOME_HREF } from './routes'
import { useDemoTheme } from './useDemoTheme'

/** 설문이 끝나면 여는 화면. 데모가 실제 /measure 로 옮겨지면 되돌린다. */
const MEASURE_HREF = '/demo/measure'
/** 기록 화면에서 "다시 고치기"로 열었을 때 돌아갈 곳 */
const RECORDS_HREF = '/demo/records'
/** 질문 다음의 마지막 화면(저장·알림) */
const CONSENT_STEP = CARE_SURVEY.length

const NUDGE_CHOICES: [NudgeMode, string, string][] = [
  ['off', '받지 않을게요', '결과·리포트의 제안은 그대로 볼 수 있어요'],
  ['banner', '화면 안에서만', '측정 화면 아래에 잠깐 띄워요'],
  ['os', '윈도우 알림까지', '창을 내려 둬도 알림으로 알려요. 알림에는 감정·점수를 넣지 않아요'],
]

/**
 * 새 디자인 흐름의 처음 설문(개인화). 측정·결과 화면과 같은 틀·글꼴·검정/흰 테마를 쓴다.
 * 문항은 features/feedback/lib/careSurvey.ts 의 CARE_SURVEY(답마다 쓰이는 곳이 정해진 8문항).
 * - 질문은 모두 건너뛸 수 있다. "남은 질문 건너뛰기"는 마지막 저장·알림 화면으로 간다.
 * - 마지막 화면에서 기록 저장 여부를 꼭 고르고(한 번 고르면 기억), 휴식 알림 방식을 고른다(기본 받지 않음).
 * - 저장된 답이 있으면 미리 골라 둔다. 기록 화면에서 "다시 고치기"로 열면 마친 뒤 기록 화면으로 돌아간다.
 * 위쪽 "설문 없이 바로 측정"은 저장 없이 측정으로 간다(측정 화면이 저장 여부를 한 번 묻는다).
 * 선택지의 그림 문자는 이 디자인의 단색 톤에 맞춰 쓰지 않는다.
 */
export default function SurveyDemo() {
  const router = useRouter()
  const [theme, toggleTheme] = useDemoTheme()
  const { supported, permission, request } = useNotificationPermission()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<SurveyAnswers>(emptyAnswers)
  const [record, setRecord] = useState<boolean | null>(null)
  const [nudgeMode, setNudgeMode] = useState<NudgeMode>('off')
  const [editing, setEditing] = useState(false)

  // 저장된 답·설정을 불러와 미리 고른다(localStorage 는 클라이언트에서만)
  useEffect(() => {
    const profile = loadProfile()
    const settings = loadSettings()
    const hasSurvey = profile !== null && (profile.treats !== undefined || profile.deskActions !== undefined
      || profile.mindActions !== undefined || profile.recoveryActions !== undefined
      || profile.breakBudget !== undefined || profile.breathing !== undefined || profile.tone !== undefined)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(answersFromProfile(profile, hasSurvey ? settings.checkinSlots : null))
    setRecord(loadConsent()?.record ?? null)
    setNudgeMode(nudgeModeOf(settings))
    setEditing(new URLSearchParams(window.location.search).has('edit'))
  }, [])

  const isConsent = step === CONSENT_STEP
  const current = isConsent ? null : CARE_SURVEY[step]
  const picked = current ? answers[current.id] : []
  const total = CARE_SURVEY.length + 1

  const toggle = (id: string) => {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.id]: toggleChoice(current, prev[current.id], id) }))
  }

  /** 답·동의·알림을 저장하고 설문을 끝낸다 */
  const finish = async () => {
    if (record === null) return
    saveProfile(profileFromAnswers(answers, loadProfile()))
    const slots = checkinFromAnswers(answers)
    const settings = loadSettings()
    saveSettings(withNudgeMode(slots ? { ...settings, checkinSlots: slots } : settings, nudgeMode))
    saveConsent(record)
    markOnboarded()
    // 윈도우 알림을 골랐으면 이때 한 번만 권한을 묻는다(거부 뒤에는 다시 묻지 않는다)
    if (nudgeMode === 'os' && supported && permission === 'default') await request()
    router.push(editing ? RECORDS_HREF : MEASURE_HREF)
  }

  const answered = answeredCount(answers)

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.readable}`} data-theme={theme}>
      <nav className={`${styles.nav} ${styles.surveyNav}`}>
        <Link href={DEMO_HOME_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono} ${styles.surveyNavStep}`}>
            {editing ? '설문 고치기' : '처음 설문'} {step + 1} / {total}
          </span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={editing ? RECORDS_HREF : MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          {editing ? '고치지 않고 돌아가기' : '설문 없이 바로 측정'}
        </Link>
      </nav>

      <div className={`${styles.body} ${styles.surveyBody}`}>
        <div className={`${styles.left} ${styles.surveyLeft}`}>
          <span className={styles.chip} style={{ alignSelf: 'flex-start' }}>
            {isConsent ? '저장과 알림' : '나만의 쉬는 법'}
          </span>
          <h1 key={step} className={styles.surveyQuestion}>
            {current ? current.question : '무엇을 저장하고\n어떻게 알려 드릴까요?'}
          </h1>
          <div>
            <p className={styles.verdictSub}>
              {current
                ? current.hint
                : '고른 답과 설정은 이 기기에만 저장되고, 기록 화면에서 언제든 바꿀 수 있어요. 영상과 얼굴 사진은 저장하지 않아요.'}
            </p>
            <div className={styles.surveySteps} aria-hidden="true" style={{ marginTop: 18 }}>
              {Array.from({ length: total }, (_, i) => (
                <i key={i} data-on={i <= step ? '' : undefined} />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.right}>
          {current ? (
            <div className={styles.surveyOptions} role="group" aria-label={current.question.replace('\n', ' ')}>
              {current.choices.map((opt) => (
                <Choice key={opt.id} on={picked.includes(opt.id)} label={opt.label} detail={opt.detail} onClick={() => toggle(opt.id)} />
              ))}
            </div>
          ) : (
            <div className={styles.consentSteps}>
              <div role="group" aria-label="측정 기록 저장">
                <p className={styles.consentQuestion}>측정 기록을 이 기기에 저장할까요?</p>
                <p className={styles.notice}>측정하는 동안 1분마다 감정 요약만 저장해요. 리포트·상태 확인·휴식 알림이 이 기록을 써요.</p>
                <div className={styles.surveyOptions}>
                  <Choice on={record === true} label="저장할게요" detail="리포트에 오늘·14일 흐름이 쌓여요" onClick={() => setRecord(true)} />
                  <Choice on={record === false} label="저장하지 않을게요" detail="측정 결과는 그 자리에서만 보여요" onClick={() => setRecord(false)} />
                </div>
              </div>
              <div role="group" aria-label="휴식 알림">
                <p className={styles.consentQuestion}>측정 중 높은 상태가 이어지면 알려 드릴까요?</p>
                <p className={styles.notice}>평소보다 높은 상태가 5분 넘게 이어질 때, 하루 2번까지 90분 간격으로만 알려요.</p>
                <div className={styles.surveyOptions}>
                  {NUDGE_CHOICES.map(([mode, label, detail]) => (
                    <Choice key={mode} on={nudgeMode === mode} label={label} detail={detail} onClick={() => setNudgeMode(mode)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className={styles.actions} style={{ marginTop: 'auto' }}>
            {step > 0 && (
              <button type="button" className={`${styles.btnGhost} ${styles.focusable}`} onClick={() => setStep((s) => s - 1)}>
                이전
              </button>
            )}
            {isConsent ? (
              <button
                type="button"
                className={`${styles.btnSolid} ${styles.focusable}`}
                onClick={() => void finish()}
                disabled={record === null}
              >
                {record === null ? '기록 저장 여부를 골라 주세요' : editing ? '고친 내용 저장' : '저장하고 측정 시작'}
              </button>
            ) : (
              <button type="button" className={`${styles.btnSolid} ${styles.focusable}`} onClick={() => setStep((s) => s + 1)}>
                {picked.length === 0 ? '건너뛰기' : '다음'}
              </button>
            )}
          </div>

          {/* 어느 질문에서든 마지막 저장·알림 화면으로 건너뛸 수 있다 */}
          {!isConsent && (
            <div className={styles.surveyFinish}>
              <button type="button" className={`${styles.textDanger} ${styles.focusable}`} onClick={() => setStep(CONSENT_STEP)}>
                남은 질문 건너뛰기
              </button>
              <p className={styles.notice}>{answered > 0 ? `지금까지 ${answered}개 질문에 답했어요` : '답하지 않은 질문은 기본 제안을 써요'}</p>
            </div>
          )}
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}

function Choice({ on, label, detail, onClick }: { on: boolean; label: string; detail?: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} className={`${styles.surveyOption} ${styles.focusable}`} onClick={onClick}>
      <span className={styles.surveyOptionText}>
        <span>{label}</span>
        {detail && <span className={styles.surveyDetail}>{detail}</span>}
      </span>
      <span className={styles.surveyMark} aria-hidden="true">
        선택
      </span>
    </button>
  )
}
