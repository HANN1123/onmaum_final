'use client'

const RISKS = [
  {
    color: '#6BAB9A',
    glow: 'rgba(107,171,154,0.5)',
    name: '잔잔',
    desc: '긍정·스트레스 모두 낮은 안정',
    label: 'Calm',
  },
  {
    color: '#D4A84B',
    glow: 'rgba(212,168,75,0.4)',
    name: '평소보다',
    desc: '스트레스가 내 평소선 위로',
    label: 'Above',
  },
  {
    color: '#E8806A',
    glow: 'rgba(232,128,106,0.4)',
    name: '위험도 알림',
    desc: '오래 무거우면 살며시 알림',
    label: 'Alert',
  },
] as const

export default function LandingRisk() {
  return (
    <section
      id="risk"
      className="border-t border-ink-200 px-[52px] py-[120px]"
    >
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-20">
        <div className="flex-1 min-w-[280px]">
          <p className="r flex items-center gap-[10px] text-[10px] font-light uppercase tracking-[0.18em] text-ink-400 before:block before:h-px before:w-5 before:bg-ink-300 before:content-['']">
            How It Reflects
          </p>
          <h2
            className="r d1 mb-5 mt-5 font-thin leading-[1.1] tracking-[-0.03em]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            단정하지 않고
            <br />
            곁에서 비춰요
          </h2>
          <p className="r d2 max-w-[380px] text-[13px] font-light leading-[1.8] text-ink-500">
            긍정과 스트레스를 따로 재서, 단정하지 않고 오브의 색과
            숨결로 비춰요. 평소보다 오래 무거우면 — 강요 없이 — 살며시
            쉬어가자고 알려드려요.
          </p>
        </div>

        <div className="flex flex-1 min-w-[320px] flex-col gap-3">
          {RISKS.map((r, i) => (
            <div
              key={r.name}
              className={`r ${i > 0 ? `d${i}` : ''} flex items-center justify-between rounded-2xl border border-ink-200 bg-white px-7 py-6 transition-all duration-300 hover:translate-x-1.5 hover:border-ink-300 hover:bg-ink-50`}
            >
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="block h-2.5 w-2.5 rounded-full"
                  style={{
                    background: r.color,
                    boxShadow: `0 0 10px ${r.glow}`,
                  }}
                />
                <div>
                  <div className="text-[15px] font-light text-ink-900">
                    {r.name}
                  </div>
                  <div className="mt-0.5 text-[11px] font-light text-ink-500">
                    {r.desc}
                  </div>
                </div>
              </div>
              <div
                className="text-[24px] font-thin"
                style={{ color: r.color }}
              >
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
