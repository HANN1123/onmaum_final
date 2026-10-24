'use client'

import { useState } from 'react'
import EmotionOrb from '@/features/ui/orb/EmotionOrb'
import DailyReport from '@/features/ui/report/DailyReport'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import type { EmotionRecord } from '@/shared/storage/db'

const CALM: EmotionResult = { happy: 0.1, calm: 0.7, sad: 0.1, angry: 0.1 }
const ANGRY: EmotionResult = { happy: 0.05, calm: 0.15, sad: 0.1, angry: 0.7 }
const NEUTRAL: EmotionResult = { happy: 0.15, calm: 0.6, sad: 0.15, angry: 0.1 }

function rec(partial: Partial<EmotionRecord>, id: number): EmotionRecord {
  return {
    id,
    timestamp: new Date(0),
    duration: 60000,
    detectionRate: 1,
    happy: 0.4,
    calm: 0.4,
    sad: 0.1,
    angry: 0.1,
    dominantEmotion: 'calm',
    flatAffectScore: 0.5,
    ...partial,
  }
}

const SAMPLE_RECORDS: EmotionRecord[] = [
  rec({ happy: 0.5, calm: 0.4, sad: 0.05, angry: 0.05, dominantEmotion: 'happy' }, 1),
  rec({ happy: 0.1, calm: 0.2, sad: 0.2, angry: 0.5, dominantEmotion: 'angry' }, 2),
  rec({ happy: 0.15, calm: 0.25, sad: 0.35, angry: 0.25, dominantEmotion: 'sad' }, 3),
]

interface Cut {
  num: string
  title: string
  body: React.ReactNode
}

export default function DemoPage() {
  const [step, setStep] = useState(0)

  const cuts: Cut[] = [
    {
      num: '①',
      title: '평소 · 측정 전',
      body: (
        <>
          <EmotionOrb emotions={CALM} recordCount={24} size={150} captionTone="light" />
          <p style={meta}>오늘 측정 3회 · 스트레스 32</p>
        </>
      ),
    },
    {
      num: '②',
      title: '측정 시작 — 켜 두면 그때부터',
      body: (
        <>
          <EmotionOrb emotions={CALM} recordCount={24} size={84} showCaption={false} />
          <p style={{ ...title, marginTop: 16 }}>일이나 공부를 시작할 때</p>
          <p style={meta}>측정을 켜 두면 표정을 살펴 기록해요</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={btnOk} onClick={() => setStep(2)}>
              측정 시작
            </button>
            <button style={btnNo}>나중에</button>
          </div>
        </>
      ),
    },
    {
      num: '③',
      title: '측정 중 — 오브 라이브',
      body: (
        <>
          <EmotionOrb emotions={ANGRY} recordCount={24} size={150} />
          <p style={{ ...meta, opacity: 0.7 }}>화면 말고 PiP 오브로만 살짝 감지</p>
        </>
      ),
    },
    {
      num: '④',
      title: '측정 종료',
      body: (
        <>
          <EmotionOrb emotions={NEUTRAL} recordCount={25} size={120} showCaption={false} />
          <p style={title}>기록했어요 ✓</p>
          <p style={meta}>방해 안 할게요. 이따 한눈에 보여드릴게요</p>
        </>
      ),
    },
    {
      num: '⑤',
      title: '하루 리포트',
      body: (
        <div style={{ width: 300, maxWidth: '90vw' }}>
          <DailyReport records={SAMPLE_RECORDS} historyRecords={SAMPLE_RECORDS} offset={0} />
        </div>
      ),
    },
  ]

  const cut = cuts[step]

  return (
    <main style={page}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>온마음 데모 — 측정을 켜 두면 그때부터</h1>
      <p style={{ ...meta, marginBottom: 28 }}>
        {cut.num} {cut.title} ({step + 1}/{cuts.length})
      </p>

      <div style={stage}>{cut.body}</div>

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <button style={navBtn} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          이전
        </button>
        <button
          style={navBtn}
          onClick={() => setStep((s) => Math.min(cuts.length - 1, s + 1))}
          disabled={step === cuts.length - 1}
        >
          다음
        </button>
      </div>
    </main>
  )
}

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at 50% 25%, #11201d, #06100e 80%)',
  color: '#dbe7e2',
  fontFamily: 'system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '48px 20px',
}
const stage: React.CSSProperties = {
  minHeight: 280,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
}
const title: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#eaf3ef', margin: 0 }
const meta: React.CSSProperties = { fontSize: 13, color: 'rgba(160,180,174,0.85)', margin: 0, textAlign: 'center' }
const btnOk: React.CSSProperties = {
  border: 'none',
  borderRadius: 20,
  padding: '8px 18px',
  fontWeight: 600,
  background: 'linear-gradient(90deg,#8fe6c4,#6fcab0)',
  color: '#06120f',
  cursor: 'pointer',
}
const btnNo: React.CSSProperties = {
  border: 'none',
  borderRadius: 20,
  padding: '8px 18px',
  fontWeight: 600,
  background: 'rgba(232,128,106,0.18)',
  color: '#f0b6a8',
  cursor: 'pointer',
}
const navBtn: React.CSSProperties = {
  border: '1px solid rgba(140,170,160,0.3)',
  borderRadius: 20,
  padding: '8px 22px',
  background: 'transparent',
  color: '#dbe7e2',
  cursor: 'pointer',
}
