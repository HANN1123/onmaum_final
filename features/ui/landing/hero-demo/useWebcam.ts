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
        // 표정 인식만 하던 때(#31 이전)와 같은 요청으로 되돌린다(2026-11-05). frameRate 를 지정하면 일부 카메라가
        // 다른 센서 모드(잘리고 확대된 화각)로 열린다. 대부분의 카메라는 지정하지 않아도 30fps 로 연다
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
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
