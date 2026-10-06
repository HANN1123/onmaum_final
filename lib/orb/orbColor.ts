import type { Emotion, EmotionResult } from '../emotion/emotionAnalysis'
import { EMOTION_ORDER, getDominantEmotion } from '../emotion/emotionAnalysis'

export type RGB = readonly [number, number, number]

export const EMOTION_HUES: Record<Emotion, RGB> = {
  happy: [245, 183, 46], // 더 선명한 골드
  calm: [46, 169, 208], // 올리브틸 → 맑은 시안: 평온을 또렷하게
  sad: [90, 111, 176], // 탁한 파랑 → 깊은 인디고: 평온과 분리
  angry: [229, 75, 53], // 더 강한 레드
}

export function rgbString(c: RGB): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** 단색 구체용 음영: 같은 색의 light(중심)→mid(=EMOTION_HUES)→dark(가장자리) + glow/그림자. */
export interface OrbShade {
  c1: string // light (중심 하이라이트)
  c2: string // mid (= EMOTION_HUES 기준색)
  c3: string // dark (가장자리)
  glow: string // 뒤 후광(rgba)
  shadow: string // 드롭 섀도(rgba)
}

export const EMOTION_SHADES: Record<Emotion, OrbShade> = {
  happy: { c1: '#FFE08A', c2: '#F5B72E', c3: '#C8860A', glow: 'rgba(245,183,46,0.32)', shadow: 'rgba(200,134,10,0.5)' },
  calm: { c1: '#BFEFFB', c2: '#2EA9D0', c3: '#15688F', glow: 'rgba(46,169,208,0.32)', shadow: 'rgba(21,104,143,0.5)' },
  sad: { c1: '#C6CFF2', c2: '#5A6FB0', c3: '#354079', glow: 'rgba(90,111,176,0.3)', shadow: 'rgba(53,64,121,0.5)' },
  angry: { c1: '#FFC4B2', c2: '#E54B35', c3: '#A81F12', glow: 'rgba(229,75,53,0.3)', shadow: 'rgba(168,31,18,0.5)' },
}

export function topTwoEmotions(e: EmotionResult): [Emotion, Emotion] {
  const sorted = [...EMOTION_ORDER].sort((a, b) => e[b] - e[a])
  return [sorted[0], sorted[1]]
}

export function gradientColors(e: EmotionResult): { from: string; to: string } {
  const [a, b] = topTwoEmotions(e)
  return { from: rgbString(EMOTION_HUES[a]), to: rgbString(EMOTION_HUES[b]) }
}

const EMOTIONS: Emotion[] = ['happy', 'calm', 'sad', 'angry']

export function accumulatedColor(emotions: EmotionResult): string {
  const total = EMOTIONS.reduce((sum, k) => sum + emotions[k], 0)
  if (total <= 0) return rgbString(EMOTION_HUES.calm)
  const blended = EMOTIONS.reduce(
    (acc, k) => {
      const w = emotions[k] / total
      const c = EMOTION_HUES[k]
      return [acc[0] + c[0] * w, acc[1] + c[1] * w, acc[2] + c[2] * w] as [
        number,
        number,
        number,
      ]
    },
    [0, 0, 0] as [number, number, number],
  ).map(Math.round) as unknown as RGB
  return rgbString(blended)
}

/** dominant 감정 색을 흰색과 섞어 PIP/배경용 옅은 radial 워시를 만든다. */
export function washBackground(emotions: EmotionResult): string {
  const [r, g, b] = EMOTION_HUES[getDominantEmotion(emotions)]
  const tint = (amt: number) =>
    `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(
      g + (255 - g) * amt,
    )},${Math.round(b + (255 - b) * amt)})`
  // amt가 클수록 흰색에 가까움. 위는 거의 흰색, 아래로 살짝 감정 색.
  return `radial-gradient(circle at 50% 28%, ${tint(0.92)} 0%, ${tint(0.74)} 90%)`
}
