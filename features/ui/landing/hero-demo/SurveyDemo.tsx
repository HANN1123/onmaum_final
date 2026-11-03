'use client'

import { useRouter } from 'next/navigation'
import OnboardingSurvey from '@/features/ui/onboarding/OnboardingSurvey'
import { markOnboarded } from '@/shared/storage/onboarding'

/** 설문이 끝나면 여는 화면. 데모가 실제 /measure 로 옮겨지면 되돌린다. */
const MEASURE_HREF = '/demo/measure'

/**
 * 새 디자인 흐름의 처음 설문. 문항·저장(프로필 reliefs → 개인 맞춤 제안)은 기존 OnboardingSurvey 를 그대로 쓴다.
 * 시각 표현은 아직 옛 디자인이며, 새 디자인으로 다시 그리는 일은 데스크톱 앱 작업에서 한다.
 */
export default function SurveyDemo() {
  const router = useRouter()
  return (
    <OnboardingSurvey
      onDone={() => {
        markOnboarded()
        router.push(MEASURE_HREF)
      }}
    />
  )
}
