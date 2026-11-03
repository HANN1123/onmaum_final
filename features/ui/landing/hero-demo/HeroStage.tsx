'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { swatchColor } from '@/features/ui/measure/demo/demoBits'
import DotOrb from '@/features/ui/measure/demo/orbs/DotOrb'
import PulseCanvas from '@/features/ui/measure/demo/PulseCanvas'
import { Roll, Swap } from '@/features/ui/measure/demo/Roll'
import styles from './HeroStage.module.css'

/**
 * 히어로의 제품 장면(Stageshow 방식). 실제 측정 화면을 단순하게 줄여 한 가지 일이 일어나는 13초 반복 장면이다.
 *
 * 이야기: 측정 중 심박이 오르고 오브가 붉어진다 → 커서가 측정 종료를 누른다 → 결과 카드가 떠오르고
 * 심박이 가장 높았던 구간이 켜진다 → 2초 넘게 보여준다 → 커서가 다시 측정을 누르면 카드가 내려가고 새 측정이 시작된다.
 *
 * Stageshow 에서 지킨 것
 * - 진짜 글자는 이야기에 필요한 것만(심박·감정·버튼·판정). 나머지는 회색 막대.
 * - 창은 잘리지 않고 통째로 보인다(잘린 창이 깨져 보인다는 사용자 판단). 결과 카드만 창의 오른쪽 가장자리에 걸친다.
 * - 커서는 거리에 따라 시간을 들여 완만한 호로 움직이고, 누르는 게 보인다. 글자를 가리지 않게 버튼 오른쪽 아래를 겨눈다.
 * - 되돌림에는 원인이 있다(다시 측정을 누름). 결과는 2초 넘게 머문다.
 * - 움직임 줄이기 설정이면 결과가 떠 있는 한 장면(포스터)만 보여준다.
 * 커서 모양은 Stageshow kit(MIT, Benji Taylor)의 macOS 화살표를 옮겨 왔다.
 */

/** 결과 카드의 그림자까지 칸 안에 들어오도록 오른쪽에 여유를 둔 폭 */
const W = 810
const H = 560

type Point = { x: number; y: number }
interface Scene {
  bpm: number
  emotion: Emotion
  live: boolean
  elapsed: number
  card: boolean
  lit: boolean
  pressed: 'end' | 'next' | null
  cursor: Point
  /** 커서 이동 시간(ms). 거리에 비례한다. */
  travel: number
}

const PARK: Point = { x: 700, y: 520 }
const START: Scene = {
  bpm: 74,
  emotion: 'calm',
  live: true,
  elapsed: 72,
  card: false,
  lit: false,
  pressed: null,
  cursor: PARK,
  travel: 0,
}
const POSTER: Scene = { ...START, bpm: 110, emotion: 'angry', live: false, card: true, lit: true }

/** 결과 카드 속 작은 차트. 회색 선 하나에 심박이 가장 높았던 구간만 불이 켜진다. */
const SPARK = (() => {
  const n = 60
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i += 1) {
    const f = i / n
    const hump = Math.exp(-(((f - 0.48) / 0.13) ** 2)) * 0.75
    const wobble = Math.sin(i * 1.7) * 0.03 + Math.sin(i * 0.6) * 0.02
    pts.push([f * 268, 70 - (0.15 + hump + wobble) * 70])
  }
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const hot = pts.filter(([x]) => x >= 0.36 * 268 && x <= 0.6 * 268)
  const h = hot.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return { d, h, x0: 0.36 * 268, x1: 0.6 * 268 }
})()

export default function HeroStage({ scheme }: { scheme: 'dark' | 'light' }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLSpanElement>(null)
  const nextRef = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(1)
  const [scene, setScene] = useState<Scene>(START)
  // 맥박 함수는 한 번만 만든다. 심박은 ref 로 읽어, 값이 바뀌어도 파형 캔버스가 처음부터 다시 그리지 않게 한다.
  const bpmRef = useRef(START.bpm)
  useEffect(() => {
    bpmRef.current = scene.bpm
  }, [scene.bpm])
  const getPulse = useCallback(() => {
    const phase = ((performance.now() / 1000) * (bpmRef.current / 60)) % 1
    const systolic = Math.exp(-(((phase - 0.16) / 0.06) ** 2))
    const dicrotic = 0.32 * Math.exp(-(((phase - 0.44) / 0.1) ** 2))
    return Math.min(1, systolic + dicrotic)
  }, [])
  const light = scheme === 'light'

  // 무대는 810×560 으로 짓고, 칸 너비에 맞춰 통째로 줄이고 늘린다.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.max(0.5, Math.min(1.25, entry.contentRect.width / W)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 측정 중이면 1초마다 측정 시간이 흐른다.
  useEffect(() => {
    if (!scene.live) return
    const id = window.setInterval(() => setScene((s) => ({ ...s, elapsed: s.elapsed + 1 })), 1000)
    return () => window.clearInterval(id)
  }, [scene.live])

  // 대본
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScene(POSTER)
      return
    }
    let alive = true
    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))
    const set = (patch: Partial<Scene>) => alive && setScene((s) => ({ ...s, ...patch }))

    /** 무대 좌표로 잰 대상의 오른쪽 아래 쪽(글자를 가리지 않게). */
    const aim = (ref: RefObject<HTMLElement | null>): Point => {
      const stage = stageRef.current?.getBoundingClientRect()
      const box = ref.current?.getBoundingClientRect()
      if (!stage || !box) return PARK
      const k = stage.width / W
      return { x: (box.left - stage.left + box.width * 0.86) / k, y: (box.top - stage.top + box.height * 0.7) / k }
    }
    let at = PARK
    /** 거리에 비례한 시간으로 이동한다(0.55~1.1초). */
    const move = async (to: Point) => {
      const travel = Math.min(1100, Math.max(550, Math.hypot(to.x - at.x, to.y - at.y) * 1.6))
      at = to
      set({ cursor: to, travel })
      await wait(travel)
    }
    const press = async (target: 'end' | 'next') => {
      set({ pressed: target })
      await wait(160)
      set({ pressed: null })
    }

    const run = async () => {
      while (alive) {
        // 1. 평온한 측정
        await wait(1600)
        // 2. 심박이 오르고, 화남이 안정되자 오브가 붉어진다(시스템이 스스로 하는 일)
        set({ bpm: 86 })
        await wait(900)
        set({ bpm: 97, emotion: 'angry' })
        await wait(900)
        set({ bpm: 106 })
        await wait(900)
        set({ bpm: 110 })
        await wait(700)
        // 3. 측정 종료
        await move(aim(endRef))
        await wait(120)
        await press('end')
        // 4. 측정이 끝나고 결과 카드가 떠오른다. 선이 그려진 뒤 심박이 가장 높았던 구간이 켜진다
        set({ live: false, card: true })
        await wait(1100)
        set({ lit: true })
        // 5. 결과가 머문다
        await wait(2400)
        // 6. 다시 측정: 카드가 내려가고 새 측정이 시작된다(되돌림의 원인)
        await move(aim(nextRef))
        await wait(120)
        await press('next')
        set({ card: false, lit: false, live: true, elapsed: 0, bpm: 74, emotion: 'calm' })
        await wait(300)
        await move(PARK)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [])

  const elapsed = `${String(Math.floor(scene.elapsed / 60)).padStart(2, '0')}:${String(scene.elapsed % 60).padStart(2, '0')}`
  const ink = light ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.75)'
  const accent = swatchColor('angry', light)

  return (
    <div ref={wrapRef} className={styles.wrap} aria-hidden="true">
      <div ref={stageRef} className={styles.stage} style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {/* 측정 화면: 통째로 보인다 */}
        <div className={styles.window}>
          <div className={styles.bar}>
            <span className={styles.logo}>ONMAUM</span>
            <span className={styles.live}>
              <i data-on={scene.live ? '' : undefined} />
              <Swap text={scene.live ? '측정 중' : '측정 종료'} /> <Roll value={elapsed} />
            </span>
            <span ref={endRef} className={styles.endBtn} data-pressed={scene.pressed === 'end' ? '' : undefined}>
              측정 종료
            </span>
          </div>
          <div className={styles.body}>
            <div className={styles.left}>
              <div className={styles.camera}>
                <span className={styles.tag}>카메라 · 얼굴 추적 중</span>
                <span className={styles.face} />
              </div>
              <div className={styles.wave}>
                <PulseCanvas getPulse={getPulse} color={ink} className={styles.waveCanvas} speed={1.6} />
              </div>
            </div>
            <div className={styles.right}>
              <div className={styles.head}>
                <span className={styles.bpm}>
                  <Roll value={String(scene.bpm)} />
                  <small>BPM</small>
                </span>
                <DotOrb getPulse={getPulse} emotion={scene.emotion} bpm={scene.bpm} scheme={scheme} size={84} />
              </div>
              <div className={styles.rows}>
                <div className={styles.row}>
                  <span>현재 감정</span>
                  <span className={styles.emotion}>
                    <i style={{ background: swatchColor(scene.emotion, light) }} />
                    <Swap text={scene.emotion === 'angry' ? '화남' : '평온'} />
                  </span>
                </div>
                <div className={styles.row}>
                  <span>신호 품질</span>
                  <span>양호</span>
                </div>
                <div className={styles.row}>
                  <b style={{ width: 52 }} />
                  <b style={{ width: 120 }} />
                </div>
                <div className={styles.row}>
                  <b style={{ width: 70 }} />
                  <b style={{ width: 88 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 결과 카드: 창의 오른쪽 가장자리에 걸친다 */}
        <div className={styles.card} data-on={scene.card ? '' : undefined}>
          <span className={styles.cardKicker}>측정 결과 · 14일 기준선 대비</span>
          <p className={styles.cardVerdict}>평소보다 무거운 시간이었습니다</p>
          <svg key={scene.card ? 'on' : 'off'} width="268" height="76" className={styles.spark}>
            <rect
              x={SPARK.x0}
              y={0}
              width={SPARK.x1 - SPARK.x0}
              height={76}
              fill={accent}
              fillOpacity={light ? 0.1 : 0.16}
              className={styles.sparkHot}
              data-on={scene.lit ? '' : undefined}
            />
            <path d={SPARK.d} pathLength={1} className={styles.sparkLine} style={{ stroke: ink }} />
            <path d={SPARK.h} className={styles.sparkHot} data-on={scene.lit ? '' : undefined} style={{ stroke: accent, fill: 'none', strokeWidth: 2 }} />
          </svg>
          <div className={styles.cardRow}>
            <span>최고 110 BPM</span>
            <span ref={nextRef} className={styles.nextBtn} data-pressed={scene.pressed === 'next' ? '' : undefined}>
              다시 측정
            </span>
          </div>
        </div>

        {/* 커서: 가로와 세로를 다른 곡선으로 옮겨 완만한 호를 그린다 */}
        <div className={styles.cursorX} style={{ transform: `translateX(${scene.cursor.x}px)`, transitionDuration: `${scene.travel}ms` }}>
          <div className={styles.cursorY} style={{ transform: `translateY(${scene.cursor.y}px)`, transitionDuration: `${scene.travel}ms` }}>
            <div className={styles.cursor} data-pressed={scene.pressed ? '' : undefined}>
              <svg height="24" width="24" viewBox="0 0 32 32" fill="none">
                <g transform="translate(10 7)">
                  <path d="m6.148 18.473 1.863-1.003 1.615-.839-2.568-4.816h4.332l-11.379-11.408v16.015l3.316-3.221z" fill="#fff" />
                  <path d="m6.431 17 1.765-.941-2.775-5.202h3.604l-8.025-8.043v11.188l2.53-2.442z" fill="#000" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
