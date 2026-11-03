import { redirect } from 'next/navigation'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'

// 웹캠 배경 히어로는 쓰지 않기로 했다(2026-11-03). 예전 링크로 들어와도 메인(제품 장면 히어로)으로 보낸다.
export default function HeroDarkPage() {
  redirect(DEMO_HOME_HREF)
}
