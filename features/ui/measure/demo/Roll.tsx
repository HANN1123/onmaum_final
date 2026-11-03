'use client'

import styles from './measureDemo.module.css'

/**
 * 바뀐 자리만 굴러가는 숫자. 각 숫자 칸은 0~9 세로 띠이고, 값이 바뀌면 그 칸의 띠만 움직인다.
 * 자리는 오른쪽부터 센다. 자릿수가 바뀌어도 일의 자리는 일의 자리로 남아 엉뚱한 칸이 구르지 않는다.
 * 발상은 Stageshow(MIT, Benji Taylor)의 Roll 에서 왔고, 구현은 우리 화면에 맞게 단순화했다.
 */
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Roll({ value, className }: { value: string; className?: string }) {
  const chars = value.split('')
  return (
    <span className={`${styles.roll} ${className ?? ''}`} role="text" aria-label={value}>
      {chars.map((ch, i) => {
        const place = chars.length - i
        if (ch >= '0' && ch <= '9') {
          return (
            <span key={`d${place}`} className={styles.rollCell} aria-hidden="true">
              <span className={styles.rollStrip} style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          )
        }
        return (
          <span key={`c${place}${ch}`} aria-hidden="true">
            {ch}
          </span>
        )
      })}
    </span>
  )
}

/** 바뀐 글자를 제자리에서 살짝 떠오르며 바꾼다(라벨·감정 이름용). */
export function Swap({ text, className }: { text: string; className?: string }) {
  return (
    <span key={text} className={`${styles.swap} ${className ?? ''}`}>
      {text}
    </span>
  )
}
