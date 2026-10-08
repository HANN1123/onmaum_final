'use client'

import { useNudge } from '@/features/feedback/hooks/useNudge'
import NudgeBanner from '@/features/feedback/components/NudgeBanner'

export default function NudgeHost() {
  const nudge = useNudge()
  return (
    <NudgeBanner
      open={nudge.bannerOpen}
      message={nudge.message}
      onClose={nudge.close}
      onMute={nudge.muteToday}
    />
  )
}
