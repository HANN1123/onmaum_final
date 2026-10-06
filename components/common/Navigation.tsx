'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/measure', label: '측정' },
  { href: '/stats', label: '오늘' },
] as const

export default function Navigation() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex w-full max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 py-4 text-center text-sm font-medium transition-colors ${
                active
                  ? 'border-b-2 border-risk-good text-ink-900'
                  : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
