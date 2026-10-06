'use client'

import { useEffect, useState } from 'react'

interface StatBarProps {
  label: string
  percent: number
  color: string
}

function StatBar({ label, percent, color }: StatBarProps) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent))
    return () => cancelAnimationFrame(id)
  }, [percent])
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[10px] tracking-[0.06em] text-ink-400">
        <span>{label}</span>
        <span style={{ color }}>{percent}%</span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-ink-200">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: color,
            transition: 'width 1.5s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  )
}

const FEATURES = [
  {
    n: '01',
    title: '실시간 감정 읽기',
    desc: '웹캠으로 표정을 읽어 기쁨·평온·슬픔·화남을 가늠해요. face-api.js 기반, 모든 분석은 브라우저 안에서만. 추정이라 단정하지 않아요.',
  },
  {
    n: '02',
    title: '1분 단위 자동 저장',
    desc: '500ms마다 샘플링하고 1분마다 자동 집계합니다. 백그라운드에서도 꾸준히 누적됩니다.',
  },
  {
    n: '03',
    title: '스트레스 지수',
    desc: '긍정과 스트레스를 따로 재고, 평소(개인 기준선) 대비 변화를 부드럽게 보여줘요. 무표정은 소진으로 치지 않습니다.',
  },
  {
    n: '04',
    title: '7일 추세 시각화',
    desc: '일주일 패턴을 한눈에 파악할 수 있어요. 언제 마음이 무거워졌는지 직관적으로 알 수 있습니다.',
  },
  {
    n: '05',
    title: '위험도 알림',
    desc: '마음에 힘이 오래 들어가 있으면 살며시 쉬어가자고 — 켜고 끄고 빈도까지 내가 정해요. 24시간 상담 연결도 한 번에.',
  },
  {
    n: '06',
    title: '완전한 프라이버시',
    desc: '서버가 없습니다. 모든 데이터는 내 기기의 IndexedDB에만 저장되고 외부로 전송되지 않습니다.',
  },
] as const

export default function LandingFeatures() {
  return (
    <section
      id="features"
      className="border-t border-ink-200 px-[52px] py-[120px]"
    >
      <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-start gap-[100px] md:grid-cols-2">
        <div className="md:sticky md:top-[120px]">
          <p className="r mb-5 flex items-center gap-[10px] text-[10px] font-light uppercase tracking-[0.18em] text-ink-400 before:block before:h-px before:w-5 before:bg-ink-300 before:content-['']">
            Features
          </p>
          <h2
            className="r d1 font-thin leading-[1.1] tracking-[-0.03em]"
            style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
          >
            감정 노동자를
            <br />
            위해 설계했습니다
          </h2>

          <div className="mt-12 flex flex-col items-center gap-10">
            {/* 미니 Orb (정적 그라디언트, ReactiveOrb mini는 추후) */}
            <div
              aria-hidden="true"
              className="h-[220px] w-[220px] rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 35% 35%, rgba(220,240,235,0.95) 0%, rgba(180,220,210,0.90) 15%, rgba(107,171,154,0.80) 40%, rgba(78,144,128,0.70) 65%, rgba(107,171,154,0.40) 85%, rgba(250,250,250,0.20) 100%)',
                boxShadow:
                  '0 0 60px rgba(107,171,154,0.20), inset 0 0 40px rgba(107,171,154,0.08)',
              }}
            />
            <div className="r d2 flex w-full flex-col gap-4">
              <StatBar label="기쁨" percent={72} color="#6BAB9A" />
              <StatBar label="평온" percent={18} color="#6E6660" />
              <StatBar label="슬픔" percent={7} color="#D4A84B" />
              <StatBar label="화남" percent={3} color="#E8806A" />
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-0">
          {FEATURES.map((f, i) => (
            <div
              key={f.n}
              className={`r ${i > 0 && i < 4 ? `d${i}` : i === 4 ? 'd2' : i === 5 ? 'd3' : ''} group flex items-start gap-7 border-t border-ink-200 py-7 ${i === FEATURES.length - 1 ? 'border-b' : ''}`}
            >
              <div className="w-7 flex-shrink-0 pt-[5px] text-[10px] tracking-[0.1em] text-ink-300">
                {f.n}
              </div>
              <div className="flex-1">
                <div
                  className="mb-2.5 font-extralight tracking-[-0.01em] text-ink-700 transition-colors duration-[250ms] group-hover:text-ink-900"
                  style={{ fontSize: 'clamp(17px, 2vw, 22px)' }}
                >
                  {f.title}
                </div>
                <div className="max-w-[400px] text-[12px] font-light leading-[1.8] text-ink-500">
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
