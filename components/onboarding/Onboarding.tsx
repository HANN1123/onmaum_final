'use client'

import { useState } from 'react'

function ArtFace() {
  return (
    <svg viewBox="0 0 100 80" className="h-[88px] w-[110px]">
      <circle cx="50" cy="38" r="28" fill="#EAF3F0" stroke="#6BAB9A" strokeWidth="1.2" />
      <circle cx="42" cy="33" r="4" fill="white" stroke="#6BAB9A" strokeWidth="1" />
      <circle cx="58" cy="33" r="4" fill="white" stroke="#6BAB9A" strokeWidth="1" />
      <circle cx="43" cy="33" r="2" fill="#6BAB9A" />
      <circle cx="59" cy="33" r="2" fill="#6BAB9A" />
      <path d="M43 47 Q50 55 57 47" fill="none" stroke="#6BAB9A" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="15" cy="14" r="3" fill="#D4A84B" opacity="0.7" />
      <circle cx="85" cy="22" r="3" fill="#E8806A" opacity="0.5" />
      <circle cx="12" cy="62" r="3" fill="#6BAB9A" opacity="0.5" />
      <circle cx="88" cy="60" r="3" fill="#D4A84B" opacity="0.4" />
    </svg>
  )
}

function ArtCamera() {
  return (
    <svg viewBox="0 0 100 80" className="h-[88px] w-[110px]">
      <rect x="12" y="16" width="76" height="54" rx="10" fill="#E8EFF5" stroke="#7AABBF" strokeWidth="1.2" />
      <circle cx="50" cy="43" r="17" fill="white" stroke="#7AABBF" strokeWidth="1.2" />
      <circle cx="50" cy="43" r="9" fill="#EEF3F8" />
      <circle cx="50" cy="43" r="4" fill="#7AABBF" />
      <rect x="34" y="9" width="14" height="9" rx="4" fill="#7AABBF" />
      <circle cx="80" cy="22" r="3" fill="#7AABBF" opacity="0.5" />
    </svg>
  )
}

function ArtChart() {
  const pts: [number, number][] = [[8, 56], [22, 44], [36, 50], [50, 32], [64, 38], [78, 24], [92, 30]]
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0]},72 L${pts[0][0]},72 Z`
  const days = ['월', '화', '수', '목', '금', '토', '일']
  return (
    <svg viewBox="0 0 100 80" className="h-[88px] w-[110px]">
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6BAB9A" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6BAB9A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[24, 40, 56, 72].map((y) => (
        <line key={y} x1="6" y1={y} x2="94" y2={y} stroke="#E0DDD7" strokeWidth="0.6" />
      ))}
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke="#6BAB9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 5 ? 3.5 : 2}
          fill={i === 5 ? '#6BAB9A' : '#fff'}
          stroke="#6BAB9A"
          strokeWidth={i === 5 ? 0 : 1.5}
        />
      ))}
      {pts.map(([x], i) => (
        <text key={i} x={x} y="79" fontSize="6.5" fill="#A3A3A3" textAnchor="middle">
          {days[i]}
        </text>
      ))}
    </svg>
  )
}

const SLIDES = [
  {
    bg: 'bg-[#EAF3F0]',
    Art: ArtFace,
    title: '온마음에 오신 걸 환영해요',
    desc: '얼굴 표정으로 하루의 마음 상태를 살피고\n위험 신호를 일찍 알아차릴 수 있어요',
  },
  {
    bg: 'bg-[#EEF3F8]',
    Art: ArtCamera,
    title: '카메라로 감정을 분석해요',
    desc: '1분마다 자동으로 기록하고\n모든 데이터는 내 기기에만 저장돼요',
  },
  {
    bg: 'bg-[#F2EEF8]',
    Art: ArtChart,
    title: '위험도와 추세를 파악해요',
    desc: '오늘의 마음 상태와 7일 패턴을 보고\n스스로를 더 잘 이해할 수 있어요',
  },
] as const

interface Props {
  onDone: () => void
}

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const slide = SLIDES[step]
  const Art = slide.Art
  const isLast = step === SLIDES.length - 1

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center bg-ink-50">
      <div className="flex items-center gap-2 pt-7">
        <span
          aria-hidden="true"
          className="inline-block h-[22px] w-[22px] rounded-full bg-gradient-to-br from-[#6BAB9A] to-[#4E9080] shadow-[0_0_12px_rgba(107,171,154,0.4)]"
        />
        <span className="text-[15px] font-bold tracking-[-0.3px] text-ink-800">온마음</span>
      </div>

      <div
        key={step}
        className="flex flex-1 flex-col items-center justify-center px-8 text-center"
      >
        <div
          className={`mb-8 flex h-[152px] w-[152px] items-center justify-center rounded-full ${slide.bg} shadow-[0_0_0_12px_rgba(107,171,154,0.05)]`}
        >
          <Art />
        </div>
        <h2 className="mb-2.5 text-[21px] font-bold leading-[1.3] tracking-[-0.5px] text-ink-900">
          {slide.title}
        </h2>
        <p className="whitespace-pre-line text-[14px] leading-[1.75] text-ink-500">
          {slide.desc}
        </p>
      </div>

      <div className="w-full max-w-[420px] px-6 pb-11">
        <div className="mb-6 flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`슬라이드 ${i + 1}`}
              className={`h-[5px] rounded-full transition-all duration-300 ease-out ${
                i === step ? 'w-[22px] bg-risk-good' : 'w-[5px] bg-ink-200'
              }`}
            />
          ))}
        </div>

        {!isLast ? (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onDone}
              className="flex-1 rounded-2xl border-[1.5px] border-ink-200 bg-white p-3.5 text-[14px] font-medium text-ink-400"
            >
              건너뛰기
            </button>
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex-[2] rounded-2xl bg-risk-good p-3.5 text-[14px] font-bold tracking-[-0.2px] text-white"
            >
              다음 →
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-2xl bg-risk-good p-4 text-[15px] font-bold tracking-[-0.3px] text-white"
          >
            시작하기
          </button>
        )}
      </div>
    </div>
  )
}
