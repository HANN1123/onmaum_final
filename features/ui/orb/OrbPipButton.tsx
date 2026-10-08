'use client'

import { createPortal } from 'react-dom'
import EmotionOrb from './EmotionOrb'
import { useOrbPip } from '@/features/ui/hooks/useOrbPip'
import { washBackground } from '@/features/ui/orb/lib/orbColor'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import styles from './OrbPipButton.module.css'

interface Props {
  emotions: EmotionResult
  recordCount: number
}

/** 오브를 Document PiP 창으로 띄우는 버튼. 미지원 브라우저면 렌더하지 않음. */
export default function OrbPipButton({ emotions, recordCount }: Props) {
  const pip = useOrbPip()
  if (!pip.supported) return null

  return (
    <>
      <button
        type="button"
        onClick={() => (pip.isOpen ? pip.close() : void pip.open())}
        className="w-full rounded-full border border-ink-300 bg-white px-6 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100"
      >
        {pip.isOpen ? '오브 창 닫기' : '🫧 오브 띄우기 (항상 위에)'}
      </button>
      {pip.container &&
        createPortal(
          // PIP 창 전체를 덮는 워시 배경 div — 감정이 바뀌면 re-render되어
          // washBackground가 갱신되고 CSS transition으로 0.6초에 걸쳐 부드럽게 물든다.
          // (reduced-motion 사용자는 .washBg의 media query로 전환만 생략, 색은 적용)
          <div className={styles.washBg} style={{ background: washBackground(emotions) }}>
            <EmotionOrb emotions={emotions} recordCount={recordCount} size={180} />
          </div>,
          pip.container,
        )}
    </>
  )
}
