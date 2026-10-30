export const CAMERA_ROTATION_KEY = 'onmaum_camera_rotation'

/** 카메라 화면을 시계 방향으로 돌리는 각도. 폰을 세워 웹캠으로 쓰면 화면이 옆으로 누운다 */
export type CameraRotation = 0 | 90 | 180 | 270

const ROTATIONS: readonly CameraRotation[] = [0, 90, 180, 270]

export function nextCameraRotation(rotation: CameraRotation): CameraRotation {
  return ROTATIONS[(ROTATIONS.indexOf(rotation) + 1) % ROTATIONS.length]
}

export function loadCameraRotation(): CameraRotation {
  if (typeof window === 'undefined') return 0
  try {
    const value = Number(localStorage.getItem(CAMERA_ROTATION_KEY))
    return ROTATIONS.find((r) => r === value) ?? 0
  } catch {
    return 0
  }
}

export function saveCameraRotation(rotation: CameraRotation): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CAMERA_ROTATION_KEY, String(rotation))
  } catch {
    // 저장 불가 환경은 조용히 무시한다. 이번 실행 동안에는 화면 상태로 유지된다
  }
}
