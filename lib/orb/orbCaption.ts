import type { Emotion } from '../emotion/emotionAnalysis'

/** 감정별 토스 톤 한 줄 카피 변형들. 매번 랜덤으로 골라 지루함을 방지. */
export const EMOTION_CAPTIONS: Record<Emotion, readonly string[]> = {
  calm: ['마음이 잔잔해요 🌿', '지금은 평온한 흐름이에요', '고요하게 잘 지나가고 있어요'],
  happy: ['오늘 기분, 좋아 보여요 ☀️', '마음이 환하게 떠 있네요', '가볍고 좋은 결이에요 ✨'],
  sad: ['오늘 좀 무거웠죠. 천천히 가요', '마음이 가라앉은 하루였나 봐요', '조금 지쳤죠. 곁에 있을게요'],
  angry: [
    '마음에 힘이 들어갔네요. 잠깐 숨 돌릴까요?',
    '조금 달아올랐나 봐요. 한 박자 쉬어가요',
    '단단하게 뭉쳤네요. 잠깐 풀어줄까요?',
  ],
}

/** 변형 중 하나를 선택. rng를 주입하면 결정적으로 테스트 가능(기본 Math.random). */
export function pickCaption(dominant: Emotion, rng: () => number = Math.random): string {
  const variants = EMOTION_CAPTIONS[dominant]
  const i = Math.min(variants.length - 1, Math.floor(rng() * variants.length))
  return variants[i]
}
