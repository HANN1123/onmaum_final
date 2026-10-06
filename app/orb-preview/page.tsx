import EmotionOrb from '@/components/orb/EmotionOrb'
import type { EmotionResult } from '@/lib/emotion/emotionAnalysis'

const STATES: { label: string; emotions: EmotionResult }[] = [
  { label: '평온', emotions: { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 } },
  { label: '기쁨', emotions: { happy: 0.7, calm: 0.2, sad: 0.05, angry: 0.05 } },
  { label: '슬픔', emotions: { happy: 0.05, calm: 0.15, sad: 0.7, angry: 0.1 } },
  { label: '화남', emotions: { happy: 0.05, calm: 0.15, sad: 0.1, angry: 0.7 } },
]

const CALM: EmotionResult = { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 }
const GROWTH = [0, 3, 10, 31]

const sectionStyle = {
  maxWidth: 960,
  margin: '0 auto 48px',
} as const

const rowStyle = {
  display: 'flex',
  gap: 28,
  flexWrap: 'wrap' as const,
  justifyContent: 'center',
}

export default function OrbPreviewPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 25%, #11201d, #06100e 80%)',
        color: '#dbe7e2',
        padding: '48px 20px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 8 }}>감정 오브 — P2 프리뷰</h1>
      <p style={{ textAlign: 'center', color: 'rgba(160,180,174,0.85)', marginBottom: 40, fontSize: 13 }}>
        엔진(orbColor/orbMotion/orbStages/orbCaption) 소비. 각자 다른 색·숨결·문구로 라이브 반응.
      </p>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 13, color: 'rgba(160,180,174,0.85)', textAlign: 'center', marginBottom: 18 }}>
          4감정 상태
        </h2>
        <div style={rowStyle}>
          {STATES.map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <EmotionOrb emotions={s.emotions} recordCount={24} size={150} captionTone="light" />
              <span style={{ fontSize: 12, color: 'rgba(155,176,170,0.8)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 13, color: 'rgba(160,180,174,0.85)', textAlign: 'center', marginBottom: 18 }}>
          성장 — 투명 → 자기 색 (누적 기록 수)
        </h2>
        <div style={rowStyle}>
          {GROWTH.map((count) => (
            <div key={count} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <EmotionOrb emotions={CALM} recordCount={count} size={110} showCaption={false} />
              <span style={{ fontSize: 12, color: 'rgba(155,176,170,0.8)' }}>{count}건</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
