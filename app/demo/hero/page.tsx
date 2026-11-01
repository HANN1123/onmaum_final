import type { Metadata } from 'next'
import HeroDemo from '@/features/ui/landing/hero-demo/HeroDemo'

export const metadata: Metadata = {
  title: '온마음 — 히어로 데모',
}

// 전체 화면 히어로 데모. 앱 chrome(상단 탭·푸터)은 AppChrome 에서 이 경로를 제외한다.
export default function HeroDemoPage() {
  return <HeroDemo />
}
