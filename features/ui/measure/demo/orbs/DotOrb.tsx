'use client'

import { useCallback, useMemo, useRef } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { approachPalette, mixRgb, ORB_PALETTE, rgba, type OrbPalette } from './emotionPalette'
import { useOrbCanvas } from './useOrbCanvas'

interface Props {
  getPulse: () => number
  /** 감정에 따라 색이 바뀐다. 화남은 빨강. */
  emotion?: Emotion
  /** 심박수. 높을수록 빨리, 세게 두근거린다. 파형 자체의 박동 간격은 getPulse 가 정한다. */
  bpm?: number
  /** 바탕이 흰색이면 뒤쪽 점은 연하게, 파동은 어둡게 찍는다. */
  scheme?: 'dark' | 'light'
  size?: number
  /**
   * 새 감정색으로 다가가는 빠르기(프레임당 비율). 기본 0.01 은 약 3초에 걸쳐 천천히 바뀐다(측정 화면).
   * 글자와 함께 바뀌어야 하는 소개 장면은 더 빠르게 준다.
   */
  colorEase?: number
  className?: string
}

type Vec3 = [number, number, number]

/** 피보나치 구: 점이 구 표면에 고르게 놓인다. 난수 없이 결정적으로 만든다. */
function fibonacciSphere(count: number): Vec3[] {
  const points: Vec3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    points.push([Math.cos(theta) * r, y, Math.sin(theta) * r])
  }
  return points
}

/** 경선 몇 개를 점으로 찍어 구의 뼈대를 만든다. */
function meridians(lines: number, perLine: number): Vec3[] {
  const points: Vec3[] = []
  for (let m = 0; m < lines; m += 1) {
    const lon = (m / lines) * Math.PI
    for (let i = 0; i < perLine; i += 1) {
      const lat = (i / perLine) * Math.PI * 2
      const r = Math.cos(lat)
      points.push([Math.cos(lon) * r, Math.sin(lat), Math.sin(lon) * r])
    }
  }
  return points
}

const TILT = 0.38

/** 55 BPM 이하를 0, 120 BPM 이상을 1로 본다. */
function intensityFromBpm(bpm: number): number {
  return Math.min(1, Math.max(0, (bpm - 55) / 65))
}

/**
 * 점 구체(구체화). 바깥 구는 점 700개와 경선 6개, 안쪽에는 반대로 도는 작은 구가 하나 더 있다.
 * 앞쪽 점은 희고 크게, 뒤쪽 점은 푸르고 작게 찍어 부피가 보인다.
 * 박동마다 빛의 띠가 북극에서 남극으로 구 표면을 훑고 지나간다.
 * 색은 감정이 정하고, 두근거림의 빠르기와 세기는 심박수가 정한다.
 */
export default function DotOrb({ getPulse, emotion = 'calm', bpm = 72, scheme = 'dark', size = 280, colorEase = 0.01, className }: Props) {
  const surface = useMemo(() => fibonacciSphere(700), [])
  const frame = useMemo(() => meridians(6, 56), [])
  const inner = useMemo(() => fibonacciSphere(160), [])
  const wavesRef = useRef<number[]>([])
  const prevRef = useRef(0)
  const smoothRef = useRef(0)
  const paletteRef = useRef<OrbPalette>(ORB_PALETTE[emotion])

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, s: number, _dt: number, t: number) => {
      const v = getPulse()
      if (prevRef.current < 0.5 && v >= 0.5) wavesRef.current.push(t)
      prevRef.current = v
      smoothRef.current += (v - smoothRef.current) * 0.2
      const p = smoothRef.current
      const intensity = intensityFromBpm(bpm)
      // 심박이 빠르면 파동도 짧게 끝나야 겹치지 않는다.
      const waveLife = Math.min(1.0, Math.max(0.4, (60 / bpm) * 0.95))
      wavesRef.current = wavesRef.current.filter((born) => t - born < waveLife)
      paletteRef.current = approachPalette(paletteRef.current, ORB_PALETTE[emotion], colorEase)
      const palette = paletteRef.current
      const white: [number, number, number] = [255, 255, 255]
      // 검정 바탕: 뒤쪽은 바닥색 → 앞쪽은 주색, 파동은 흰색.
      // 흰 바탕: 뒤쪽은 연한 주색 → 앞쪽은 짙은 주색, 파동은 바닥색(가장 어두운 띠).
      const light = scheme === 'light'
      const farColor = light ? mixRgb(palette.base, white, 0.45) : palette.deep
      const nearColor = light ? mixRgb(palette.base, palette.deep, 0.55) : palette.base
      const waveColor = light ? palette.deep : white


      const c = s / 2
      const R = c * 0.84 * (1 + p * (0.02 + intensity * 0.07))
      if (light) {
        // 흰 바탕에서 구가 납작해지지 않도록 아주 옅은 원을 먼저 깐다.
        ctx.beginPath()
        ctx.arc(c, c, R * 0.98, 0, Math.PI * 2)
        ctx.fillStyle = rgba(palette.base, 0.07)
        ctx.fill()
      }
      const cosT = Math.cos(TILT)
      const sinT = Math.sin(TILT)

      const project = (pt: Vec3, angle: number): { x: number; y: number; depth: number; lat: number } => {
        const [x, y, z] = pt
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        const rx = x * cosA + z * sinA
        const rz = -x * sinA + z * cosA
        const ry = y * cosT - rz * sinT
        const rz2 = y * sinT + rz * cosT
        return { x: rx, y: ry, depth: (rz2 + 1) / 2, lat: y }
      }

      // 박동 파동: 위도 1(북극) → -1(남극) 으로 내려가는 밝은 띠
      const waveBoost = (lat: number) => {
        let boost = 0
        for (const born of wavesRef.current) {
          const age = (t - born) / waveLife
          const head = 1 - age * 2.2
          const d = (lat - head) / 0.16
          boost += Math.exp(-d * d) * (1 - age)
        }
        return Math.min(1, boost * (0.5 + intensity * 0.8))
      }

      const drawPoint = (
        pt: Vec3,
        angle: number,
        radius: number,
        baseAlpha: number,
        baseSize: number,
        withWave: boolean,
      ) => {
        const q = project(pt, angle)
        const limb = 0.35 + 0.65 * q.depth
        const boost = withWave ? waveBoost(q.lat) : 0
        // 흰 바탕에서는 뒤쪽 점도 더 보여야 하고 점이 조금 커야 한다.
        const falloff = light ? Math.pow(q.depth, 1.3) : q.depth * q.depth
        const alpha = Math.min(1, (baseAlpha * falloff + (light ? 0.12 : 0.05) + intensity * 0.12) * limb + boost * 0.9)
        const dot = baseSize * (0.45 + q.depth) * (light ? 1.15 : 1) + boost * 0.9
        // 뒤쪽은 바닥색, 앞쪽은 주색, 파동이 지나는 곳은 흰색에 가깝게
        const color = mixRgb(mixRgb(farColor, nearColor, Math.sqrt(q.depth)), waveColor, boost * 0.8)
        ctx.beginPath()
        ctx.arc(c + q.x * radius, c + q.y * radius, dot, 0, Math.PI * 2)
        ctx.fillStyle = rgba(color, alpha)
        ctx.fill()
      }

      const angle = t * (0.12 + intensity * 0.22)
      for (const pt of inner) drawPoint(pt, -angle * 1.6, R * 0.5, 0.45, 1.0, false)
      for (const pt of frame) drawPoint(pt, angle, R, 0.35, 0.9, true)
      for (const pt of surface) drawPoint(pt, angle, R, 0.85, 1.25, true)
    },
    [getPulse, emotion, bpm, scheme, colorEase, surface, frame, inner],
  )

  const ref = useOrbCanvas(size, draw)
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />
}
