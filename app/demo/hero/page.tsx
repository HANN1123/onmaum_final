import { redirect } from 'next/navigation'
import { DEMO_HOME_HREF } from '@/features/ui/landing/hero-demo/routes'

// 밝은 타자 히어로 시안은 쓰지 않기로 했다. 예전 링크로 들어와도 메인(제품 장면 히어로)으로 보낸다.
export default function HeroDemoPage() {
  redirect(DEMO_HOME_HREF)
}
