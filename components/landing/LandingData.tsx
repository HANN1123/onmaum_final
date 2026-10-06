'use client'

const CELLS = [
  {
    num: '1',
    unit: '분',
    label: '자동 저장 단위\n500ms 감지 → 1분 집계',
  },
  {
    num: '7',
    unit: '일',
    label: '추세 기간\n패턴 인식에 충분한 시간',
  },
  {
    num: '0',
    unit: '개',
    label: '서버 의존성\n완전 오프라인 · 프라이버시 우선',
  },
] as const

export default function LandingData() {
  return (
    <section
      id="data"
      className="border-t border-ink-200 px-[52px] py-[120px]"
    >
      <div
        className="mx-auto grid max-w-[1100px] grid-cols-1 gap-px bg-ink-200 sm:grid-cols-3"
      >
        {CELLS.map((c, i) => (
          <div
            key={c.num}
            className={`r ${i > 0 ? `d${i}` : ''} bg-ink-50 px-10 py-[52px]`}
          >
            <div
              className="mb-4 font-thin leading-none tracking-[-0.05em]"
              style={{ fontSize: 'clamp(56px, 8vw, 96px)' }}
            >
              {c.num}
              <span className="text-[0.38em] font-extralight text-ink-400">
                {c.unit}
              </span>
            </div>
            <div className="whitespace-pre-line text-[11px] font-light leading-[1.7] tracking-[0.06em] text-ink-500">
              {c.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
