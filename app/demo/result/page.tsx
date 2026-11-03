import type { Metadata } from 'next'
import ResultDemo from '@/features/ui/measure/demo/ResultDemo'

export const metadata: Metadata = {
  title: '온마음 — 통화 결과',
}

// 통화(측정)가 끝난 뒤 나오는 결과 화면 데모. 앱 chrome 은 AppChrome 에서 /demo/result 를 제외한다.
export default function ResultDemoPage() {
  return <ResultDemo />
}
