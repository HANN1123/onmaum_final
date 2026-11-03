'use client'

import { usePathname } from 'next/navigation'
import ContactsFooter from '@/features/ui/common/ContactsFooter'
import Navigation from '@/features/ui/common/Navigation'
import NudgeHost from '@/features/feedback/components/NudgeHost'

// 자체 nav 를 가진 전체 화면 경로. 정확히 일치하거나 그 아래 경로면 앱 chrome 을 숨긴다.
const BARE_ROUTES: readonly string[] = ['/', '/demo/hero', '/demo/hero-dark', '/demo/measure', '/demo/orb-lab', '/demo/result', '/demo/report']

interface Props {
  children: React.ReactNode
}

export default function AppChrome({ children }: Props) {
  const pathname = usePathname()
  const isBare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))

  if (isBare) {
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
