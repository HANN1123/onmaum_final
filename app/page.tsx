'use client'

import LandingCTA from '@/features/ui/landing/LandingCTA'
import LandingData from '@/features/ui/landing/LandingData'
import LandingFeatures from '@/features/ui/landing/LandingFeatures'
import LandingFooter from '@/features/ui/landing/LandingFooter'
import LandingHero from '@/features/ui/landing/LandingHero'
import LandingNav from '@/features/ui/landing/LandingNav'
import LandingRisk from '@/features/ui/landing/LandingRisk'
import { useScrollReveal } from '@/features/ui/hooks/useScrollReveal'

export default function LandingPage() {
  useScrollReveal()

  return (
    <div
      data-theme="landing"
      className="min-h-screen bg-ink-50 text-ink-900"
    >
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingData />
      <LandingRisk />
      <LandingCTA />
      <LandingFooter />
    </div>
  )
}
