'use client'

import { usePathname } from 'next/navigation'
import ContactsFooter from '@/features/ui/common/ContactsFooter'
import Navigation from '@/features/ui/common/Navigation'
import NudgeHost from '@/features/feedback/components/NudgeHost'

interface Props {
  children: React.ReactNode
}

export default function AppChrome({ children }: Props) {
  const pathname = usePathname()
  // 랜딩(/)에서는 앱 chrome 숨김 — 랜딩이 자체 nav/footer 가짐
  const isLanding = pathname === '/'

  if (isLanding) {
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
