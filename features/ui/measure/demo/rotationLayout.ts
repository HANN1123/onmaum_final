import type { CSSProperties } from 'react'
import type { CameraRotation } from '@/shared/storage/cameraRotation'

/**
 * 측정 화면 카메라 회전의 좌표 규칙(한 곳에서만 정한다).
 * - 분석 입력: 원본 영상을 시계 방향으로 rotation 만큼 돌린 것. 거울 반전하지 않는다(face-api·BlazeFace·rPPG crop 공통).
 * - 화면 표시: 그 분석 입력을 좌우로 한 번 뒤집은 것(거울). 얼굴 상자도 표시할 때 한 번만 뒤집는다.
 * - 칸 채우기: 돌린 뒤 크기(Wr, Hr)로 칸(Cw, Ch)을 꽉 채운다. s = max(Cw/Wr, Ch/Hr), 가운데 정렬(넘치는 부분은 잘림).
 */

export function isSideways(rotation: CameraRotation): boolean {
  return rotation === 90 || rotation === 270
}

/** 돌린 뒤 영상 크기 */
export function rotatedSize(vw: number, vh: number, rotation: CameraRotation): { w: number; h: number } {
  return isSideways(rotation) ? { w: vh, h: vw } : { w: vw, h: vh }
}

export interface CoverLayout {
  scale: number
  /** 칸 안에 그려지는 (돌린) 영상의 크기와 왼쪽 위 위치. 칸보다 크면 음수 위치로 잘린다 */
  dispW: number
  dispH: number
  offsetX: number
  offsetY: number
}

export function coverLayout(cw: number, ch: number, vw: number, vh: number, rotation: CameraRotation): CoverLayout | null {
  if (!(cw > 0 && ch > 0 && vw > 0 && vh > 0)) return null
  const { w, h } = rotatedSize(vw, vh, rotation)
  const scale = Math.max(cw / w, ch / h)
  const dispW = w * scale
  const dispH = h * scale
  return { scale, dispW, dispH, offsetX: (cw - dispW) / 2, offsetY: (ch - dispH) / 2 }
}

/**
 * video 요소 스타일. 요소는 원본 비율 크기(vw·s × vh·s)로 칸 가운데에 두고, 먼저 돌린 뒤 좌우로 뒤집는다.
 * CSS transform 은 오른쪽부터 적용되므로 `scaleX(-1) rotate(r)` 순서가 "돌린 다음 거울"이다.
 */
export function rotatedVideoStyle(cw: number, ch: number, vw: number, vh: number, rotation: CameraRotation): CSSProperties | null {
  const layout = coverLayout(cw, ch, vw, vh, rotation)
  if (!layout) return null
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: vw * layout.scale,
    height: vh * layout.scale,
    maxWidth: 'none',
    objectFit: 'fill',
    transform: `translate(-50%, -50%) scaleX(-1) rotate(${rotation}deg)`,
  }
}

/** 분석 입력 기준(비반전) 정규화 상자를 화면(거울) 기준으로 */
export function mirrorBox<T extends { x: number; w: number }>(box: T): T {
  return { ...box, x: 1 - box.x - box.w }
}
