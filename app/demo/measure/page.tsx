import type { Metadata } from 'next'
import MeasureDemo from '@/features/ui/measure/demo/MeasureDemo'

export const metadata: Metadata = {
  title: '온마음 — 측정 화면 데모',
}

// 측정 화면 데모. 앱 chrome 은 AppChrome 에서 /demo/measure 를 제외한다.
export default function MeasureDemoPage() {
  return <MeasureDemo />
}
