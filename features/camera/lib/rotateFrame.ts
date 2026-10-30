import type { CameraRotation } from '@/shared/storage/cameraRotation'

/** 현재 영상 프레임을 시계 방향으로 돌려 canvas에 그린다. 프레임은 메모리 안에서만 쓰고 저장하지 않는다 */
export function drawRotatedFrame(
  video: HTMLVideoElement,
  rotation: CameraRotation,
  canvas: HTMLCanvasElement,
): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const width = video.videoWidth
  const height = video.videoHeight
  const sideways = rotation === 90 || rotation === 270
  // 크기를 지정하면 canvas 내용과 변환 상태가 함께 초기화된다
  canvas.width = sideways ? height : width
  canvas.height = sideways ? width : height

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(video, -width / 2, -height / 2, width, height)
  return true
}
