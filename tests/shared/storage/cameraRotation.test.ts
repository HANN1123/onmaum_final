import { beforeEach, describe, expect, it } from 'vitest'
import {
  CAMERA_ROTATION_KEY,
  loadCameraRotation,
  nextCameraRotation,
  saveCameraRotation,
} from '@/shared/storage/cameraRotation'

describe('cameraRotation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('90도씩 돌고 270도 다음은 0도다', () => {
    expect(nextCameraRotation(0)).toBe(90)
    expect(nextCameraRotation(90)).toBe(180)
    expect(nextCameraRotation(180)).toBe(270)
    expect(nextCameraRotation(270)).toBe(0)
  })

  it('저장한 각도를 다시 읽는다', () => {
    saveCameraRotation(270)
    expect(loadCameraRotation()).toBe(270)
  })

  it('저장값이 없거나 잘못되면 0도로 시작한다', () => {
    expect(loadCameraRotation()).toBe(0)
    localStorage.setItem(CAMERA_ROTATION_KEY, '45')
    expect(loadCameraRotation()).toBe(0)
    localStorage.setItem(CAMERA_ROTATION_KEY, 'abc')
    expect(loadCameraRotation()).toBe(0)
  })
})
