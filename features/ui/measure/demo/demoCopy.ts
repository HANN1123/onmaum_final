import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

/** 데모 화면이 함께 쓰는 아래쪽 안내 문구. */
export const LEGAL =
  '기록은 이 기기 안에만 남습니다 · 의료 진단이 아니라 자기 인식을 돕는 도구입니다 · 도움이 필요하면 1577-0199 · 109'

/**
 * 결과 문장에 쓰는 표정 꾸밈말. 감정 이름 뒤에 '한'을 붙이면 '슬픔한'처럼 틀리므로 하나씩 정한다.
 * 문장은 "OO 표정이 가장 많았습니다"(2026-11-22). 앱이 읽는 것은 표정이므로 속마음을 단정하지 않고,
 * 계산(얼굴을 찾은 표본 중 가장 많은 표정)과 맞게 '가장 오래'가 아니라 '가장 많았다'로 쓴다.
 */
const EXPRESSION_ADJ: Record<Emotion, string> = { calm: '평온한', happy: '기쁜', sad: '슬픈', angry: '화난' }

/** 결과 화면 큰 문장. 얼굴을 한 번도 찾지 못했으면(dominant 없음) 기록이 없다고 말한다 */
export function resultVerdict(dominant: Emotion | null): string {
  return dominant ? `${EXPRESSION_ADJ[dominant]} 표정이 가장 많았습니다` : '얼굴을 찾지 못해 표정 기록이 없습니다'
}
