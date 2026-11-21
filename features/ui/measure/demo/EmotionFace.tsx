import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'

/**
 * 감정 상태 옆에 붙이는 단색 선화 얼굴(2026-11-21 팀 디자인 검토 1안, 2026-11-22 이 방식으로 확정해 늘 보인다).
 * 팀원이 만든 표정 그림(평온·기쁨·슬픔·화남)의 눈·입·눈썹 모양을 따르되, 색 있는 원은 빼고 선만 남겼다.
 * 원 색을 그대로 쓰면 오브·게이지의 스트레스 단계 색과 두 색 체계가 섞여 헷갈리기 때문이다.
 * 선 색은 글자 색(currentColor)을 따라 다크·화이트 테마에 맞춰진다. 감정 이름 글자가 함께 있으므로 그림은 화면 읽기에서 숨긴다.
 */
const FACE: Record<Emotion, React.ReactNode> = {
  calm: (
    <>
      <ellipse cx="11.6" cy="14" rx="1.4" ry="1.8" fill="currentColor" stroke="none" />
      <ellipse cx="20.4" cy="14" rx="1.4" ry="1.8" fill="currentColor" stroke="none" />
      <path d="M12.6 19.6 Q16 22.4 19.4 19.6" />
    </>
  ),
  happy: (
    <>
      <path d="M9.4 14.2 Q11.6 11.4 13.8 14.2" />
      <path d="M18.2 14.2 Q20.4 11.4 22.6 14.2" />
      <path d="M12.2 18.6 Q16 19.4 19.8 18.6 Q19.4 23.6 16 23.6 Q12.6 23.6 12.2 18.6 Z" />
    </>
  ),
  sad: (
    <>
      <path d="M9.2 12.4 Q11.2 11.2 13.2 10.4" />
      <path d="M22.8 12.4 Q20.8 11.2 18.8 10.4" />
      <circle cx="11.6" cy="15.6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="20.4" cy="15.6" r="1.35" fill="currentColor" stroke="none" />
      <path d="M13.2 22 Q16 19.6 18.8 22" />
    </>
  ),
  angry: (
    <>
      <path d="M9.2 10.6 L13.4 12.6" />
      <path d="M22.8 10.6 L18.6 12.6" />
      <circle cx="11.6" cy="15.6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="20.4" cy="15.6" r="1.35" fill="currentColor" stroke="none" />
      <path d="M13.6 22 Q16 20.2 18.4 22" />
    </>
  ),
}

export default function EmotionFace({ emotion, className }: { emotion: Emotion; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-emotion={emotion}
    >
      <circle cx="16" cy="16" r="14" />
      {FACE[emotion]}
    </svg>
  )
}
