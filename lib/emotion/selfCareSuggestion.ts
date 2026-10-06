import type { Emotion } from './emotionAnalysis'
import type { Profile } from '../storage/profile'

/** 프로필이 없을 때의 감정별 기본 제안 (토스 톤, 비단정). */
const DEFAULT_BY_EMOTION: Record<Emotion, string> = {
  calm: '지금 이 평온함, 잠깐 음미해봐요',
  happy: '좋은 기분, 한 번 더 누려봐요',
  sad: '따뜻한 차 한 잔 어떠세요',
  angry: '잠깐 깊게 숨 한 번 쉬어볼까요',
}

/**
 * 지배 감정 + 로컬 프로필(선호 해소법)로 회복 제안을 만든다.
 * 프로필이 있으면 선호를 반영하고, 없으면 감정별 기본 제안.
 */
export function suggestionFor(dominant: Emotion, profile: Profile | null): string {
  if (profile && profile.reliefs.length > 0) {
    const relief = profile.reliefs[0]
    if (dominant === 'angry') return `잠깐 숨 돌리고, ${relief} 어때요?`
    if (dominant === 'sad') return `오늘 좀 무거웠죠. ${relief} 하고 가요`
    return `${relief}, 지금 어떠세요?`
  }
  return DEFAULT_BY_EMOTION[dominant]
}
