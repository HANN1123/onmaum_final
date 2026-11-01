import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 시연용 맥박 신호. 실제 rPPG 가 붙기 전까지 PPG 모양의 파형과 BPM 을 흉내 낸다.
 * - 한 박동은 수축기 봉우리 하나와 작은 중복 절흔(dicrotic notch) 으로 만든다.
 * - BPM 은 박동마다 조금씩 흔들리며 72 근처로 되돌아온다.
 * getPulse() 는 현재 파형 값(0~1)을 돌려주고, 캔버스가 매 프레임 읽어 간다.
 */
export function useSimulatedVitals(active: boolean, baseBpm = 72) {
  const [bpm, setBpm] = useState(baseBpm)
  const [elapsed, setElapsed] = useState(0)
  const phaseRef = useRef(0)
  const bpmRef = useRef(baseBpm)
  const valueRef = useRef(0)
  const beatRef = useRef(false)

  useEffect(() => {
    if (!active) return
    let frame = 0
    let last = performance.now()
    let lastBpmPublish = 0

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const prev = phaseRef.current
      let phase = prev + dt * (bpmRef.current / 60)
      beatRef.current = false
      if (phase >= 1) {
        phase -= 1
        beatRef.current = true
        // 박동마다 BPM 을 조금 흔들고 기준값으로 되돌린다.
        // 시연에서 목표를 바꾸면 몇 박동 안에 따라가도록 되돌림을 세게 둔다.
        const drift = (Math.random() - 0.5) * 1.2 + (baseBpm - bpmRef.current) * 0.3
        bpmRef.current = Math.min(baseBpm + 8, Math.max(baseBpm - 8, bpmRef.current + drift))
      }
      phaseRef.current = phase

      const systolic = Math.exp(-(((phase - 0.16) / 0.06) ** 2))
      const dicrotic = 0.32 * Math.exp(-(((phase - 0.44) / 0.1) ** 2))
      const noise = (Math.random() - 0.5) * 0.02
      valueRef.current = Math.min(1, Math.max(0, systolic + dicrotic + noise))

      if (now - lastBpmPublish > 1000) {
        lastBpmPublish = now
        setBpm(Math.round(bpmRef.current))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, baseBpm])

  useEffect(() => {
    if (!active) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [active])

  const getPulse = useCallback(() => valueRef.current, [])
  const getBeat = useCallback(() => beatRef.current, [])

  return { bpm, elapsed, getPulse, getBeat }
}

/** 초 → 00:12:34 */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
