'use client'

import { useState } from 'react'
import { saveProfile } from '@/shared/storage/profile'

interface Option {
  emoji: string
  label: string
}

const STEPS: { question: string; options: Option[] }[] = [
  {
    question: '지친 날, 뭘 마시거나\n먹으면 좀 나아져요?',
    options: [
      { emoji: '☕', label: '커피 한 잔' },
      { emoji: '🍵', label: '따뜻한 차' },
      { emoji: '💧', label: '시원한 물' },
      { emoji: '🍫', label: '달달한 간식' },
      { emoji: '🥤', label: '탄산 한 모금' },
      { emoji: '🍊', label: '상큼한 과일' },
    ],
  },
  {
    question: '1분이 생긴다면\n뭘 하고 싶어요?',
    options: [
      { emoji: '🚶', label: '짧은 산책' },
      { emoji: '🪟', label: '창밖 보기' },
      { emoji: '💆', label: '어깨 스트레칭' },
      { emoji: '🙆', label: '기지개 켜기' },
      { emoji: '😌', label: '잠깐 눈 감기' },
      { emoji: '🚰', label: '세수·손 씻기' },
    ],
  },
  {
    question: '마음이 시끄러울 땐\n어떻게 하면 좀 가라앉아요?',
    options: [
      { emoji: '🫁', label: '박스 호흡' },
      { emoji: '🧘', label: '3분 명상' },
      { emoji: '🖼️', label: '좋아하는 사진 보기' },
      { emoji: '🕯️', label: '향초·아로마' },
      { emoji: '🪴', label: '반려동물·식물 보기' },
      { emoji: '🌥️', label: '잠깐 멍때리기' },
    ],
  },
  {
    question: '위로가 필요한 날엔\n뭐가 힘이 돼요?',
    options: [
      { emoji: '💌', label: '응원 한 마디' },
      { emoji: '📜', label: '좋아하는 명언' },
      { emoji: '😸', label: '귀여운 사진·밈' },
      { emoji: '💬', label: '누군가와 잠깐 수다' },
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
    STEPS.map(() => new Set<string>()),
  )

  const currentStep = STEPS[step]
  const currentSelected = selections[step]
  const isLast = step === STEPS.length - 1

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

  const handleNext = () => {
    if (isLast) {
      const allSelected = Array.from(
        new Set(selections.flatMap((s) => Array.from(s))),
      )
      saveProfile({ reliefs: allSelected })
      onDone?.()
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
          {STEPS.map((_, i) => (
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
      </section>
    </main>
  )
}
