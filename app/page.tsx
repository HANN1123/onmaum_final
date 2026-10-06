'use client'

import LandingCTA from '@/components/landing/LandingCTA'
import LandingData from '@/components/landing/LandingData'
import LandingFeatures from '@/components/landing/LandingFeatures'
import LandingFooter from '@/components/landing/LandingFooter'
import LandingHero from '@/components/landing/LandingHero'
import LandingNav from '@/components/landing/LandingNav'
import LandingRisk from '@/components/landing/LandingRisk'
import { useScrollReveal } from '@/hooks/ui/useScrollReveal'

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
