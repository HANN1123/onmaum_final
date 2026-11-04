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
        // 6fd22ac와 같은 요청을 유지한다. 프레임률 지정은 일부 카메라의 센서 모드와 화각을 바꾼다.
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
