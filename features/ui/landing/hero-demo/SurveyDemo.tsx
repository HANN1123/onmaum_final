'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LEGAL } from '@/features/ui/measure/demo/demoCopy'
import styles from '@/features/ui/measure/demo/measureDemo.module.css'
import { SURVEY_STEPS } from '@/features/ui/onboarding/OnboardingSurvey'
import { markOnboarded } from '@/shared/storage/onboarding'
import { saveProfile } from '@/shared/storage/profile'
import { jetbrainsMono, sora } from './fonts'
import { DEMO_HOME_HREF } from './routes'
import { useDemoTheme } from './useDemoTheme'

/** 설문이 끝나면 여는 화면. 데모가 실제 /measure 로 옮겨지면 되돌린다. */
const MEASURE_HREF = '/demo/measure'

/**
 * 새 디자인 흐름의 처음 설문(개인화). 측정·결과 화면과 같은 틀·글꼴·검정/흰 테마를 쓴다.
 * 문항(SURVEY_STEPS)과 저장 규칙은 기존 OnboardingSurvey 와 같다.
 * - 단계마다 여러 개를 고를 수 있다.
 * - 어느 단계에서든 마칠 수 있고, 지금까지 고른 답을 프로필 reliefs 로 저장한다(→ 개인 맞춤 제안).
 * - 마치면 설문 완료를 기록하고 측정으로 간다.
 * 위쪽 "설문 없이 바로 측정"은 메인과 같이 저장 없이 측정으로 간다.
 * 선택지의 그림 문자는 이 디자인의 단색 톤에 맞춰 쓰지 않는다(문구는 같다).
 */
export default function SurveyDemo() {
  const router = useRouter()
  const [theme, toggleTheme] = useDemoTheme()
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Set<string>[]>(() => SURVEY_STEPS.map(() => new Set<string>()))

  const current = SURVEY_STEPS[step]
  const picked = selections[step]
  const isLast = step === SURVEY_STEPS.length - 1
  const total = selections.reduce((sum, s) => sum + s.size, 0)
  const finishLabel = total === 0 ? '건너뛰고 시작하기' : `${total}개로 시작하기`

  const toggle = (label: string) => {
    setSelections((prev) =>
      prev.map((s, i) => {
        if (i !== step) return s
        const next = new Set(s)
        if (next.has(label)) next.delete(label)
        else next.add(label)
        return next
      }),
    )
  }

  /** 지금까지 고른 답(현재 단계 포함)을 저장하고 설문을 끝낸다 */
  const finish = () => {
    saveProfile({ reliefs: Array.from(new Set(selections.flatMap((s) => Array.from(s)))) })
    markOnboarded()
    router.push(MEASURE_HREF)
  }

  return (
    <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.shell} ${styles.readable}`} data-theme={theme}>
      <nav className={`${styles.nav} ${styles.surveyNav}`}>
        <Link href={DEMO_HOME_HREF} className={`${styles.logo} ${styles.focusable}`}>
          ONMAUM
        </Link>
        <div className={styles.navMid}>
          <span className={`${styles.live} ${styles.mono} ${styles.surveyNavStep}`}>
            처음 설문 {step + 1} / {SURVEY_STEPS.length}
          </span>
          <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
            {theme === 'dark' ? '화이트' : '다크'}
          </button>
        </div>
        <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
          설문 없이 바로 측정
        </Link>
      </nav>

      <div className={`${styles.body} ${styles.bodyScroll}`}>
        <div className={`${styles.left} ${styles.surveyLeft}`}>
          <span className={styles.chip} style={{ alignSelf: 'flex-start' }}>
            나만의 쉬는 법
          </span>
          <h1 key={step} className={styles.surveyQuestion}>
            {current.question}
          </h1>
          <div>
            <p className={styles.verdictSub}>
              여러 개 골라도 됩니다. 고른 답은 이 기기에만 저장되고, 리포트에서 쉬는 법을 제안할 때 씁니다.
            </p>
            <div className={styles.surveySteps} aria-hidden="true" style={{ marginTop: 18 }}>
              {SURVEY_STEPS.map((_, i) => (
                <i key={i} data-on={i <= step ? '' : undefined} />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.surveyOptions} role="group" aria-label={current.question.replace('\n', ' ')}>
            {current.options.map((opt) => {
              const on = picked.has(opt.label)
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={on}
                  className={`${styles.surveyOption} ${styles.focusable}`}
                  onClick={() => toggle(opt.label)}
                >
                  <span>{opt.label}</span>
                  <span className={styles.surveyMark} aria-hidden="true">
                    선택
                  </span>
                </button>
              )
            })}
          </div>

          <div className={styles.actions} style={{ marginTop: 'auto' }}>
            {step > 0 && (
              <button type="button" className={`${styles.btnGhost} ${styles.focusable}`} onClick={() => setStep((s) => s - 1)}>
                이전
              </button>
            )}
            <button
              type="button"
              className={`${styles.btnSolid} ${styles.focusable}`}
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            >
              {isLast ? finishLabel : '다음'}
            </button>
          </div>

          {/* 어느 단계에서든 설문을 마칠 수 있다. 마지막 단계는 위 버튼이 같은 역할을 한다 */}
          {!isLast && (
            <div className={styles.surveyFinish}>
              <button type="button" className={`${styles.textDanger} ${styles.focusable}`} onClick={finish}>
                설문 마치고 시작하기
              </button>
              <p className={styles.notice}>지금까지 선택한 답은 저장돼요</p>
            </div>
          )}
        </div>
      </div>
      <p className={styles.legal}>{LEGAL}</p>
    </section>
  )
}
