import type { Metadata } from 'next'
import ReportDemo from '@/features/ui/measure/demo/ReportDemo'

export const metadata: Metadata = {
  title: '온마음 — 오늘 리포트',
}

// 하루 리포트 화면 데모. 앱 chrome 은 AppChrome 에서 /demo/report 를 제외한다.
export default function ReportDemoPage() {
  return <ReportDemo />
}
