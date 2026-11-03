import { useEffect, type RefObject } from 'react'

const SENSITIVITY = 0.8

/**
 * 마우스의 가로 이동으로 영상을 앞뒤로 스크럽한다(자동 재생 없음).
 * seek 가 끝나기 전에 또 seek 하지 않도록, seeked 에서 밀린 목표 시각을 이어 간다.
 */
export function useScrubVideo(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const video = videoRef.current
    if (!video) return
    let prevX: number | null = null
    let targetTime = 0
    let seeking = false

    const seekTo = (time: number) => {
      seeking = true
      video.currentTime = time
    }
    const onSeeked = () => {
      seeking = false
      if (Math.abs(video.currentTime - targetTime) > 0.01) seekTo(targetTime)
    }
    const onMove = (event: MouseEvent) => {
      const duration = video.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      if (prevX === null) {
        prevX = event.clientX
        return
      }
      const delta = event.clientX - prevX
      prevX = event.clientX
      const next = targetTime + (delta / window.innerWidth) * SENSITIVITY * duration
      targetTime = Math.min(duration, Math.max(0, next))
      if (!seeking) seekTo(targetTime)
    }

    video.addEventListener('seeked', onSeeked)
    window.addEventListener('mousemove', onMove)
    return () => {
      video.removeEventListener('seeked', onSeeked)
      window.removeEventListener('mousemove', onMove)
    }
  }, [videoRef, enabled])
}
