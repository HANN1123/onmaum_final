'use client'

import { useEffect, useState, type RefObject } from 'react'
import styles from './measureDemo.module.css'
import type { FaceBox } from './useFaceTrack'

interface Props {
  box: FaceBox | null
  videoRef: RefObject<HTMLVideoElement | null>
  label?: string
}

/**
 * 얼굴 상자 오버레이. object-fit: cover 로 잘린 영상 영역을 계산해서
 * 영상 비율 좌표(0~1)를 화면 픽셀로 옮긴다. 부모는 position: relative/absolute 여야 한다.
 */
export default function FaceLayer({ box, videoRef, label = '얼굴 추적 중' }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ cw: 0, ch: 0, vw: 0, vh: 0 })

  useEffect(() => {
    const video = videoRef.current
    if (!container || !video) return
    const update = () => {
      setSize({
        cw: container.clientWidth,
        ch: container.clientHeight,
        vw: video.videoWidth,
        vh: video.videoHeight,
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(container)
    video.addEventListener('loadedmetadata', update)
    update()
    return () => {
      observer.disconnect()
      video.removeEventListener('loadedmetadata', update)
    }
  }, [container, videoRef])

  let rect: { left: number; top: number; width: number; height: number } | null = null
  if (box && size.vw > 0 && size.vh > 0 && size.cw > 0) {
    const scale = Math.max(size.cw / size.vw, size.ch / size.vh)
    const dw = size.vw * scale
    const dh = size.vh * scale
    const ox = (size.cw - dw) / 2
    const oy = (size.ch - dh) / 2
    rect = {
      left: ox + box.x * dw,
      top: oy + box.y * dh,
      width: box.w * dw,
      height: box.h * dh,
    }
  }

  return (
    <div ref={setContainer} className={styles.faceLayer} aria-hidden="true">
      {rect && (
        <div className={styles.faceBox} style={rect}>
          <span className={styles.faceTag}>{label}</span>
        </div>
      )}
    </div>
  )
}
