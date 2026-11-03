'use client'

import { TextMorph } from 'torph/react'

/**
 * 바뀌는 글자를 끊김 없이 이어 바꾼다(Torph, MIT). 숫자는 바뀐 자리만 미끄러지고, 폭이 달라지면 옆 글자도 함께 밀린다.
 * 바뀌는 조각은 화면 읽기에서 숨기고 원래 글자를 한 번만 읽히며, 움직임 줄이기 설정을 따른다.
 * 기본 곡선이 motion.css 의 --ease-out(easing.dev "Snappy Out")과 같은 값이다.
 */
export function Morph({ children, className }: { children: string; className?: string }) {
  return (
    <TextMorph locale="ko" className={className}>
      {children}
    </TextMorph>
  )
}
