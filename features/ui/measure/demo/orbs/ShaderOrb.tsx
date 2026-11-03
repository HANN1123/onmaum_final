'use client'

import { useEffect, useRef } from 'react'
import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import { approachPalette, ORB_PALETTE, type OrbPalette } from './emotionPalette'

interface Props {
  getPulse: () => number
  /** 감정에 따라 색이 바뀐다. 화남은 빨강. */
  emotion?: Emotion
  /** 구 자체가 어두운 공이라 바탕색과 무관하다. 점 구체와 같은 호출 모양을 위해 받기만 한다. */
  scheme?: 'dark' | 'light'
  size?: number
  className?: string
}

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

// 구 안에서 오로라가 흐르고, 가장자리는 프레넬 림 라이트로 또렷하게 선다.
// 박동이 오면 전체가 밝아지고 윤곽이 아주 조금 숨 쉰다.
const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_pulse;
uniform vec3 u_deep;
uniform vec3 u_main;
uniform vec3 u_accent;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float wobble = (fbm(vec2(ang * 1.2 + 3.0, u_time * 0.25)) - 0.5) * 0.018;
  float R = 0.40 + u_pulse * 0.012 + wobble;

  float z = sqrt(max(0.0, R * R - r * r)) / R;
  vec3 n = normalize(vec3(uv / R, max(z, 0.001)));

  float t = u_time * 0.12;
  vec2 q = uv * 3.0 + vec2(fbm(uv * 2.0 + t), fbm(uv * 2.0 - t));
  float f = fbm(q + t * 0.7);
  float g = fbm(q * 1.7 - t);

  vec3 col = mix(u_deep, u_main, smoothstep(0.30, 0.72, f));
  col = mix(col, u_accent, smoothstep(0.62, 0.95, g));

  col *= 0.45 + 0.55 * z;
  float rim = pow(1.0 - z, 3.0);
  col += vec3(0.85, 0.92, 1.0) * rim * 0.45;
  float spec = pow(max(0.0, dot(n, normalize(vec3(-0.45, 0.65, 0.6)))), 48.0);
  col += vec3(1.0) * spec * 0.35;
  col *= 1.0 + u_pulse * 0.4;

  float edge = smoothstep(R, R - 0.0035, r);
  gl_FragColor = vec4(col * edge, edge);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('셰이더 컴파일 실패:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** WebGL 셰이더 오브. 캔버스 2D 로는 안 나오는 깊이와 흐름을 프래그먼트 셰이더로 그린다. */
export default function ShaderOrb({ getPulse, emotion = 'calm', size = 280, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const emotionRef = useRef(emotion)
  const paletteRef = useRef<OrbPalette>(ORB_PALETTE[emotion])

  useEffect(() => {
    emotionRef.current = emotion
  }, [emotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
    if (!gl) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(program, 'u_res')
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uPulse = gl.getUniformLocation(program, 'u_pulse')
    const uDeep = gl.getUniformLocation(program, 'u_deep')
    const uMain = gl.getUniformLocation(program, 'u_main')
    const uAccent = gl.getUniformLocation(program, 'u_accent')
    const setColor = (location: WebGLUniformLocation | null, [r, g, b]: [number, number, number]) => {
      gl.uniform3f(location, r / 255, g / 255, b / 255)
    }
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    let frame = 0
    let smooth = 0
    const start = performance.now()
    const loop = (now: number) => {
      smooth += (getPulse() - smooth) * 0.2
      gl.uniform1f(uTime, (now - start) / 1000)
      gl.uniform1f(uPulse, smooth)
      paletteRef.current = approachPalette(paletteRef.current, ORB_PALETTE[emotionRef.current], 0.04)
      setColor(uDeep, paletteRef.current.deep)
      setColor(uMain, paletteRef.current.base)
      setColor(uAccent, paletteRef.current.accent)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
    }
  }, [getPulse, size])

  return <canvas ref={canvasRef} className={className} style={{ width: size, height: size }} aria-hidden="true" />
}
