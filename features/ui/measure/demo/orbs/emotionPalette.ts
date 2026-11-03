import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

export type Rgb = [number, number, number]

export interface OrbPalette {
  /** 주된 색 */
  base: Rgb
  /** 어두운 바닥색 */
  deep: Rgb
  /** 밝은 강조색 */
  accent: Rgb
}

/** 감정별 오브 색. 화남은 빨강, 기쁨은 금빛, 평온은 청록, 슬픔은 푸른빛. */
export const ORB_PALETTE: Record<Emotion, OrbPalette> = {
  happy: { base: [245, 192, 74], deep: [120, 66, 8], accent: [255, 236, 170] },
  calm: { base: [79, 209, 197], deep: [18, 40, 115], accent: [184, 170, 255] },
  sad: { base: [86, 120, 255], deep: [16, 26, 90], accent: [150, 190, 255] },
  angry: { base: [255, 64, 52], deep: [110, 8, 18], accent: [255, 160, 120] },
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** 현재 색을 목표 색 쪽으로 조금 옮긴다(프레임마다 불러 부드럽게 바뀌게). */
export function approachPalette(current: OrbPalette, target: OrbPalette, t: number): OrbPalette {
  return {
    base: mixRgb(current.base, target.base, t),
    deep: mixRgb(current.deep, target.deep, t),
    accent: mixRgb(current.accent, target.accent, t),
  }
}

export function rgba([r, g, b]: Rgb, alpha: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}
