'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { CameraRotation } from '@/shared/storage/cameraRotation'
import { coverLayout } from './rotationLayout'
import styles from './measureDemo.module.css'
import type { FaceBox } from './useFaceTrack'

interface Props {
  box: FaceBox | null
  videoRef: RefObject<HTMLVideoElement | null>
  label?: string
  /** 카메라 회전(시계 방향). 상자 좌표는 돌린 화면 기준이므로 칸 채움도 돌린 크기로 계산한다 */
  rotation?: CameraRotation
}

/**
 * 얼굴 상자 오버레이. object-fit: cover 로 잘린 영상 영역을 계산해서
 * 영상 비율 좌표(0~1)를 화면 픽셀로 옮긴다. 부모는 position: relative/absolute 여야 한다.
 */
export default function FaceLayer({ box, videoRef, label = '얼굴 추적 중', rotation = 0 }: Props) {
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
  const layout = box ? coverLayout(size.cw, size.ch, size.vw, size.vh, rotation) : null
  if (box && layout) {
    rect = {
      left: layout.offsetX + box.x * layout.dispW,
      top: layout.offsetY + box.y * layout.dispH,
      width: box.w * layout.dispW,
      height: box.h * layout.dispH,
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
