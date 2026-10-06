'use client'

import { useNudge } from '@/hooks/nudge/useNudge'
import NudgeBanner from '@/components/nudge/NudgeBanner'

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
