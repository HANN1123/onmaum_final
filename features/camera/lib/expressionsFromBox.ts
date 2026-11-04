import * as faceapi from 'face-api.js'

/**
 * 이미 찾은 얼굴 상자(픽셀)로 face-api 의 랜드마크·정렬·표정만 돌린다. 얼굴 검출(SSD)은 건너뛴다.
 * face-api 의 `detectSingleFace(...).withFaceLandmarks().withFaceExpressions()` 와 같은 순서다.
 *   상자 → 얼굴 잘라내기 → 68점 랜드마크 → 랜드마크로 정렬한 상자(alignedRect) → 정렬한 얼굴로 표정
 * 측정 화면은 rPPG 엔진이 매 프레임 BlazeFace 로 찾은 상자를 넘긴다. SSD 보다 잘 잡고, 가장 무거운 단계를 없앤다.
 * 프레임과 잘라낸 얼굴은 메모리에서만 쓰고 저장하지 않는다.
 */
export interface PixelBox {
  x: number
  y: number
  w: number
  h: number
}

export async function expressionsFromBox(
  input: HTMLVideoElement | HTMLCanvasElement,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
  score = 1,
): Promise<faceapi.FaceExpressions | null> {
  // 상자를 영상 안으로 자른다. 너무 작으면(가장자리에 걸친 경우) 건너뛴다
  const x = Math.max(0, box.x)
  const y = Math.max(0, box.y)
  const w = Math.min(imageWidth, box.x + box.w) - x
  const h = Math.min(imageHeight, box.y + box.h) - y
  if (!(w > 16 && h > 16)) return null

  const imageDims = { width: imageWidth, height: imageHeight }
  const detection = new faceapi.FaceDetection(
    Math.min(1, Math.max(0, score)),
    new faceapi.Rect(x / imageWidth, y / imageHeight, w / imageWidth, h / imageHeight),
    imageDims,
  )
  const [face] = await faceapi.extractFaces(input, [detection])
  if (!face) return null
  const unshifted = (await faceapi.nets.faceLandmark68Net.detectLandmarks(face)) as faceapi.FaceLandmarks68
  const withLandmarks = faceapi.extendWithFaceLandmarks(faceapi.extendWithFaceDetection({}, detection), unshifted)
  const [aligned] = await faceapi.extractFaces(input, [withLandmarks.alignedRect])
  if (!aligned) return null
  return (await faceapi.nets.faceExpressionNet.predictExpressions(aligned)) as faceapi.FaceExpressions
}
