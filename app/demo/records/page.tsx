import type { Metadata } from 'next'
import RecordsDemo from '@/features/ui/measure/demo/RecordsDemo'

export const metadata: Metadata = {
  title: '온마음 — 기록',
}

// 기록 화면 데모. 지난 날들과 내 기록 관리. 앱 chrome 은 AppChrome 에서 /demo/records 를 제외한다.
export default function RecordsDemoPage() {
  return <RecordsDemo />
}
