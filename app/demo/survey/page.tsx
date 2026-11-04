import type { Metadata } from 'next'
import SurveyDemo from '@/features/ui/landing/hero-demo/SurveyDemo'

export const metadata: Metadata = {
  title: '온마음 — 처음 설문',
}

// 메인의 "측정 시작"이 여는 개인화 설문. 끝나면 측정 화면으로 간다. 앱 chrome 은 AppChrome 에서 /demo/survey 를 제외한다.
export default function SurveyDemoPage() {
  return <SurveyDemo />
}
