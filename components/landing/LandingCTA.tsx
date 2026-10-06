'use client'

import Link from 'next/link'

export default function LandingCTA() {
  return (
    <section
      id="cta"
      className="relative flex min-h-[70dvh] flex-col items-center justify-center overflow-hidden border-t border-ink-200 px-[52px] py-[120px]"
    >
      {/* 단순 글로우 배경 (Canvas 대체) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(107,171,154,0.12) 0%, rgba(107,171,154,0.04) 40%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-[600px] text-center">
        <p className="r flex justify-center gap-[10px] text-[10px] font-light uppercase tracking-[0.18em] text-ink-400">
          <span className="block h-px w-5 self-center bg-ink-300" />
          지금 시작하기
        </p>
        <h2
          className="r d1 mt-6 font-thin leading-[1.05] tracking-[-0.04em]"
          style={{ fontSize: 'clamp(40px, 6vw, 84px)' }}
        >
          지금 마음을
          <br />
          살펴보세요.
        </h2>
        <p className="r d2 mt-8 text-[13px] font-light leading-[1.85] text-ink-500">
          카메라 권한 하나면 충분해요. 설치 없이 브라우저에서 바로.
        </p>
        <div className="r d3 mt-12 flex items-center justify-center gap-[14px]">
          <Link
            href="/measure"
            className="rounded-full bg-risk-good px-[30px] py-[13px] text-[12px] font-normal uppercase tracking-[0.08em] text-white shadow-[0_0_40px_rgba(107,171,154,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_48px_rgba(107,171,154,0.35)]"
          >
            앱 시작하기
          </Link>
          <a
            href="https://github.com/woobin-01/onmaum"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-ink-300 px-[30px] py-[13px] text-[12px] font-light uppercase tracking-[0.08em] text-ink-500 transition-all hover:border-ink-400 hover:text-ink-900"
          >
            GitHub →
          </a>
        </div>
      </div>
    </section>
  )
}
