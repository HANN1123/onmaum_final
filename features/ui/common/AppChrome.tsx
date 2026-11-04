'use client'

import { usePathname } from 'next/navigation'
import ContactsFooter from '@/features/ui/common/ContactsFooter'
import Navigation from '@/features/ui/common/Navigation'
import NudgeHost from '@/features/feedback/components/NudgeHost'

// 자체 nav 를 가진 전체 화면 경로. 정확히 일치하거나 그 아래 경로면 앱 chrome 을 숨긴다.
const BARE_ROUTES: readonly string[] = ['/', '/demo/hero', '/demo/hero-dark', '/demo/hero-stage', '/demo/measure', '/demo/orb-lab', '/demo/result', '/demo/report', '/demo/records', '/demo/survey']

interface Props {
  children: React.ReactNode
}

export default function AppChrome({ children }: Props) {
  const pathname = usePathname()
  const isBare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
  // Electron 위젯 창(/widget)은 오브만 그린다 — 내비·푸터·넛지 숨김
  const isWidget = pathname === '/widget' || pathname === '/widget/'

  if (isBare || isWidget) {
    return <>{children}</>
  }

  return (
    <>
      <Navigation />
      <div className="flex-1">{children}</div>
      <ContactsFooter />
      <NudgeHost />
    </>
  )
}
