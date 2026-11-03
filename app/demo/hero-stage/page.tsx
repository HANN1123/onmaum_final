import type { Metadata } from 'next'
import HeroDark from '@/features/ui/landing/hero-demo/HeroDark'

export const metadata: Metadata = {
  title: '온마음 — 히어로 데모(제품 장면)',
}

// 검정 히어로의 배경을 웹캠 대신 반복 재생되는 제품 장면으로 바꾼 비교용 시안.
export default function HeroStagePage() {
  return <HeroDark media="stage" />
}
