'use client'

import { useState } from 'react'
import { saveProfile } from '@/shared/storage/profile'

interface Option {
  emoji: string
  label: string
}

/** 선택지를 바꾸면 features/feedback/lib/selfCareSuggestion.ts의 RELIEF_SUGGESTIONS에도 문장을 추가한다 */
export const SURVEY_STEPS: { question: string; options: Option[] }[] = [
  {
    question: '쉴 때 즐겨 먹거나\n마시는 것은 무엇인가요?',
    options: [
      { emoji: '☕', label: '커피' },
      { emoji: '🍵', label: '따뜻한 차' },
      { emoji: '💧', label: '시원한 물' },
      { emoji: '🍫', label: '달달한 간식' },
      { emoji: '🥤', label: '탄산음료' },
      { emoji: '🍊', label: '과일' },
    ],
  },
  {
    question: '잠깐 짬이 나면\n무엇을 하고 싶나요?',
    options: [
      { emoji: '🚶', label: '짧은 산책' },
      { emoji: '🪟', label: '창밖 보기' },
      { emoji: '💆', label: '스트레칭' },
      { emoji: '🙆', label: '기지개 켜기' },
      { emoji: '😌', label: '잠깐 눈 감기' },
      { emoji: '🚰', label: '세수·손 씻기' },
    ],
  },
  {
    question: '마음이 복잡할 때\n무엇이 도움이 되나요?',
    options: [
      { emoji: '🫁', label: '천천히 숨쉬기' },
      { emoji: '🧘', label: '짧은 명상' },
      { emoji: '🖼️', label: '좋아하는 사진 보기' },
      { emoji: '🕯️', label: '향초·아로마' },
      { emoji: '🪴', label: '반려동물·식물 보기' },
      { emoji: '🌥️', label: '멍하니 쉬기' },
    ],
  },
  {
    question: '힘든 날에는\n무엇이 위로가 되나요?',
    options: [
      { emoji: '💌', label: '응원의 말' },
      { emoji: '📜', label: '좋아하는 글귀' },
      { emoji: '😸', label: '귀여운 사진' },
      { emoji: '💬', label: '누군가와 대화' },
      { emoji: '🚿', label: '따뜻한 샤워' },
      { emoji: '🛌', label: '일찍 잠들기' },
    ],
  },
]

interface Props {
  onDone?: () => void
}

/** "나만의 스트레스 해소법" 설문 — 대화형 위저드(시안 B). (spec §7) */
export default function OnboardingSurvey({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Set<string>[]>(() =>
    SURVEY_STEPS.map(() => new Set<string>()),
  )

  const currentStep = SURVEY_STEPS[step]
  const currentSelected = selections[step]
  const isLast = step === SURVEY_STEPS.length - 1

  const toggle = (label: string) => {
    setSelections((prev) =>
      prev.map((s, i) => {
        if (i !== step) return s
        const copy = new Set(s)
        if (copy.has(label)) {
          copy.delete(label)
        } else {
          copy.add(label)
        }
        return copy
      }),
    )
  }

  /** 지금까지 고른 답(현재 단계 포함)을 저장하고 설문을 끝낸다 */
  const finish = () => {
    const allSelected = Array.from(
      new Set(selections.flatMap((s) => Array.from(s))),
    )
    saveProfile({ reliefs: allSelected })
    onDone?.()
  }

  const handleNext = () => {
    if (isLast) {
      finish()
    } else {
      setStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    setStep((s) => s - 1)
  }

  const totalSelected = selections.reduce((acc, s) => acc + s.size, 0)
  const finishLabel =
    totalSelected === 0 ? '건너뛰고 시작하기' : `${totalSelected}개로 시작하기`

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-white">
      <section className="w-full max-w-md">
        {/* 진행 점 */}
        <div className="flex justify-center gap-2 mb-8">
          {SURVEY_STEPS.map((_, i) => (
            <span
              key={i}
              className={[
                'block h-2 rounded-full transition-all',
                i === step
                  ? 'w-6 bg-risk-good'
                  : i < step
                    ? 'w-2 bg-risk-good/40'
                    : 'w-2 bg-ink-200',
              ].join(' ')}
            />
          ))}
        </div>

        {/* 질문 */}
        <h2 className="text-xl font-semibold text-ink-900 leading-snug whitespace-pre-line mb-6">
          {currentStep.question}
        </h2>

        {/* 옵션 버튼 */}
        <div className="space-y-2.5 mb-8">
          {currentStep.options.map((opt) => {
            const active = currentSelected.has(opt.label)
            return (
              <button
                key={opt.label}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(opt.label)}
                className={[
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition-all',
                  active
                    ? 'border-risk-good bg-risk-good/10 text-ink-900 font-medium'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
                ].join(' ')}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span>{opt.label}</span>
                {active && (
                  <span className="ml-auto text-risk-good text-base">✓</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="flex-none rounded-2xl border border-ink-200 px-4 py-3 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
            >
              이전
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 rounded-2xl bg-risk-good py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {isLast ? finishLabel : '다음'}
          </button>
        </div>

        {/* 어느 단계에서든 설문을 마칠 수 있다. 마지막 단계는 위 버튼이 같은 역할을 한다 */}
        {!isLast && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={finish}
              className="text-sm text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
            >
              설문 마치고 시작하기
            </button>
            <p className="mt-1 text-xs text-ink-400">지금까지 선택한 답은 저장돼요</p>
          </div>
        )}
      </section>
    </main>
  )
}
