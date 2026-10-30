'use client'

import { useEffect, useRef } from 'react'
import type { CameraRotation } from '@/shared/storage/cameraRotation'

interface Props {
  active: boolean
  rotation?: CameraRotation
  onReady?: (video: HTMLVideoElement) => void
  onError?: (error: Error) => void
}

export default function CameraView({ active, rotation = 0, onReady, onError }: Props) {
  const sideways = rotation === 90 || rotation === 270
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const callbacksRef = useRef({ onReady, onError })

  useEffect(() => {
    callbacksRef.current = { onReady, onError }
  })

  useEffect(() => {
    if (!active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) videoRef.current.srcObject = null
      return
    }

    let cancelled = false
    let acquired: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        acquired = stream
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        callbacksRef.current.onReady?.(video)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error = err instanceof Error ? err : new Error(String(err))
        callbacksRef.current.onError?.(error)
      })

    // 측정 화면을 떠나거나(unmount) active가 바뀌면 이 실행이 얻은 카메라를 끈다.
    return () => {
      cancelled = true
      if (acquired) {
        acquired.getTracks().forEach((t) => t.stop())
        if (streamRef.current === acquired) streamRef.current = null
        const video = videoRef.current
        if (video && video.srcObject === acquired) video.srcObject = null
      }
    }
  }, [active])

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 ${
        sideways ? 'mx-auto aspect-[3/4] max-w-xs' : 'aspect-video'
      }`}
    >
      {/* 분석 프레임과 같게 먼저 돌린 뒤 거울처럼 뒤집는다. 세로 틀에서는 돌리기 전 폭이 틀의 높이와 같아야 한다 */}
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute left-1/2 top-1/2 object-cover"
        style={{
          width: sideways ? '133.3333%' : '100%',
          height: sideways ? '75%' : '100%',
          transform: `translate(-50%, -50%) scaleX(-1) rotate(${rotation}deg)`,
        }}
      />
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-ink-500">측정을 시작하면 카메라가 켜집니다</p>
        </div>
      )}
    </div>
  )
}
