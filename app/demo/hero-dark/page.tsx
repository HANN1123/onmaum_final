import type { Metadata } from 'next'
import HeroDark from '@/features/ui/landing/hero-demo/HeroDark'

export const metadata: Metadata = {
  title: '온마음 — 통화 중인 당신의 마음을 읽는 기록',
}

// 검정 배경 전체 화면 히어로 데모. 앱 chrome 은 AppChrome 에서 이 경로를 제외한다.
export default function HeroDarkPage() {
  return <HeroDark />
}
