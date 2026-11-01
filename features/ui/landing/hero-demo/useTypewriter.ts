import { useEffect, useState } from 'react'

/**
 * 타자 효과. startDelay(ms) 뒤부터 speed(ms) 간격으로 한 글자씩 드러낸다.
 * text 가 바뀌면 처음부터 다시 친다.
 */
export function useTypewriter(text: string, speed = 38, startDelay = 600) {
  // text 와 함께 저장해 두면 text 가 바뀐 첫 렌더에서 effect 없이도 0 으로 되돌릴 수 있다.
  const [state, setState] = useState({ text, count: 0 })
  const count = state.text === text ? state.count : 0

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    let shown = 0
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        shown += 1
        setState({ text, count: Math.min(shown, text.length) })
        if (shown >= text.length && interval) clearInterval(interval)
      }, speed)
    }, startDelay)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [text, speed, startDelay])

  return { displayed: text.slice(0, count), done: count >= text.length }
}
