'use client'

import Link from 'next/link'
import ReactiveOrb from '../orb/ReactiveOrb'

export default function LandingHero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100dvh] w-full items-center overflow-hidden"
    >
      <ReactiveOrb />

      <div className="relative z-10 max-w-[560px] px-[52px]">
        <div className="mb-6 flex items-center gap-[10px] text-[10px] font-light uppercase tracking-[0.2em] text-[#6BAB9A]">
          <span className="block h-px w-7 bg-[#6BAB9A] opacity-60" />
          마음 상태 셀프 회고
        </div>

        <h1
          className="mb-8 font-thin leading-[0.97] tracking-[-0.04em]"
          style={{ fontSize: 'clamp(48px, 6.5vw, 88px)' }}
        >
          마음을
          <br />
          <em className="not-italic text-ink-300">온전히</em>
          <br />
          살피는 일.
        </h1>

        <p className="mb-12 max-w-[360px] text-[13px] font-light leading-[1.85] text-ink-500">
          웹캠으로 표정을 분석하고 1분 단위로 마음 상태를 기록합니다.
          모든 데이터는 브라우저에만 저장되어, 누구도 들여다볼 수 없습니다.
        </p>

        <div className="flex items-center gap-[14px]">
          <Link
            href="/measure"
            className="rounded-full bg-[#6BAB9A] px-[30px] py-[13px] text-[12px] font-normal uppercase tracking-[0.08em] text-white shadow-[0_0_40px_rgba(107,171,154,0.28),0_0_80px_rgba(107,171,154,0.1)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_48px_rgba(107,171,154,0.4),0_0_100px_rgba(107,171,154,0.15)]"
          >
            앱 시작하기
          </Link>
          <a
            href="#features"
            className="group flex items-center gap-2 text-[12px] font-light uppercase tracking-[0.08em] text-ink-400 transition-colors hover:text-ink-900"
          >
            살펴보기
            <span className="h-px w-7 bg-current transition-all duration-200 group-hover:w-10" />
          </a>
        </div>
      </div>

      <div className="absolute bottom-9 left-[52px] z-10 flex items-center gap-[10px] text-[9px] uppercase tracking-[0.18em] text-ink-300">
        <span className="animate-scrollPulse block h-11 w-px bg-gradient-to-b from-[#6BAB9A] to-transparent" />
        Scroll
      </div>
    </section>
  )
}
