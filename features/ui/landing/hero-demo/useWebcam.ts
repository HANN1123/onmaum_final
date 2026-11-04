import { useEffect, useState, type RefObject } from 'react'

export type WebcamStatus = 'idle' | 'ready' | 'denied'

/** 전면 웹캠을 video 요소에 붙인다. enabled 가 false 이면 아무것도 하지 않는다. */
export function useWebcam(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): WebcamStatus {
  const [status, setStatus] = useState<WebcamStatus>('idle')

  useEffect(() => {
    if (!enabled) return
    const video = videoRef.current
    if (!video) return
    let cancelled = false
    let stream: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({
        // rPPG 는 초당 10프레임 이상이 필요하고 30이 가장 좋다. 카메라가 낮은 프레임으로 열리지 않게 30을 요청한다
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false,
      })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        video.srcObject = s
        await video.play()
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('denied')
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      if (video.srcObject) video.srcObject = null
    }
  }, [videoRef, enabled])

  return status
}
