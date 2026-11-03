import type { FaceDetector } from '@mediapipe/tasks-vision'

/**
 * BlazeFace(MediaPipe) 얼굴 검출기 — 메인 스레드 전용, 앱에서 하나만 만들어 재사용한다.
 * WASM 인스턴스를 측정마다 새로 만들면 close() 후에도 메모리가 반납되지 않아(시작/정지 1회당 약 20MB 증가)
 * 한 번 만든 것을 실험실과 측정 화면이 같이 쓴다. 런타임·모델은 앱 안(/vendor, /models)에서 불러온다.
 */
let blazePromise: Promise<FaceDetector> | null = null

export function getBlazeFace(): Promise<FaceDetector> {
  blazePromise ??= createBlazeFace().catch((err: unknown) => {
    blazePromise = null
    throw err
  })
  return blazePromise
}

async function createBlazeFace(): Promise<FaceDetector> {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks('/vendor/mediapipe')
  return FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/blazeface/blaze_face_short_range.tflite', delegate: 'CPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  })
}
