import { JetBrains_Mono, Sora } from 'next/font/google'

/** 검정 시안 계열(히어로·측정 시안)이 함께 쓰는 라틴 표시 서체. 한글은 전역 Pretendard 로 떨어진다. */
export const sora = Sora({ subsets: ['latin'], weight: ['200', '300', '400'], display: 'swap', variable: '--font-sora' })

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-jbm',
})
