'use client'

import { useCallback, useRef } from 'react'
import { useOrbCanvas } from './useOrbCanvas'

interface Props {
  getPulse: () => number
  size?: number
  count?: number
  className?: string
}

type Vec3 = [number, number, number]

interface Particle {
  axis: Vec3
  pos: Vec3
  speed: number
  radius: number
  jitter: number
}

/** 시드 고정 난수(mulberry32). 렌더마다 같은 군집이 나온다. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomUnit(rand: () => number): Vec3 {
  const z = rand() * 2 - 1
  const a = rand() * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  return [Math.cos(a) * r, Math.sin(a) * r, z]
}

function makeParticles(count: number): Particle[] {
  const rand = mulberry32(20261101)
  return Array.from({ length: count }, () => ({
    axis: randomUnit(rand),
    pos: randomUnit(rand),
    speed: 0.08 + rand() * 0.22,
    radius: 0.55 + rand() * 0.45,
    jitter: rand() * Math.PI * 2,
  }))
}

/** 임의의 축을 중심으로 점을 회전시킨다(로드리게스 공식). */
function rotate(p: Vec3, axis: Vec3, angle: number): Vec3 {
  const [x, y, z] = p
  const [ax, ay, az] = axis
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dot = ax * x + ay * y + az * z
  return [
    x * cos + (ay * z - az * y) * sin + ax * dot * (1 - cos),
    y * cos + (az * x - ax * z) * sin + ay * dot * (1 - cos),
    z * cos + (ax * y - ay * x) * sin + az * dot * (1 - cos),
  ]
}

/**
 * 입자 군집. 수백 개의 점이 제각기 다른 축으로 느리게 돌며 구름 같은 구를 이룬다.
 * 박동이 오면 전체가 안쪽으로 조여들었다가 풀린다.
 */
export default function SwarmOrb({ getPulse, size = 280, count = 520, className }: Props) {
  const particlesRef = useRef<Particle[] | null>(null)
  const smoothRef = useRef(0)

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, s: number, dt: number, t: number) => {
      if (!particlesRef.current || particlesRef.current.length !== count) {
        particlesRef.current = makeParticles(count)
      }
      smoothRef.current += (getPulse() - smoothRef.current) * 0.25
      const p = smoothRef.current
      const c = s / 2
      const R = c * 0.88 * (1 - p * 0.1)

      ctx.globalCompositeOperation = 'lighter'
      for (const particle of particlesRef.current) {
        particle.pos = rotate(particle.pos, particle.axis, particle.speed * dt)
        const [x, y, z] = particle.pos
        const breathe = 1 + Math.sin(t * 0.8 + particle.jitter) * 0.04
        const rr = R * particle.radius * breathe
        const depth = (z + 1) / 2
        const alpha = 0.12 + depth * 0.6 + p * 0.25
        const dot = 0.6 + depth * 1.4
        ctx.beginPath()
        ctx.arc(c + x * rr, c + y * rr, dot, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(190, 215, 255, ${alpha})`
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    },
    [getPulse, count],
  )

  const ref = useOrbCanvas(size, draw)
  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />
}
