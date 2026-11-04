import { getBlazeFace } from '../../../features/rppg/engine/blazeFace'
import { expressionsFromBox } from '../../../features/camera/lib/expressionsFromBox'
import { loadFaceApiModels } from '../../../features/camera/lib/faceDetection'
import { normalizeExpressions, getDominantEmotion } from '../../../features/algorithm/emotion/emotionAnalysis'
import { smoothEmotion } from '../../../features/algorithm/emotion/emotionSmoothing'
import { nextPresence, NO_PRESENCE } from '../../../features/ui/measure/demo/trackSmoothing'
import * as faceapi from 'face-api.js'

// 영상은 저장하지 않고 원본 시각 순서대로 탐색해 확률만 반환한다.
window.evaluateVideo = async (url) => {
  const blaze = await getBlazeFace()
  await loadFaceApiModels()
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  document.body.append(video)
  const wait = (event) => new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', fail); resolve() }
    const fail = () => { clearTimeout(timer); video.removeEventListener(event, done); video.removeEventListener('error', fail); reject(new Error(`영상 읽기 실패: ${video.error?.message}`)) }
    const timer = setTimeout(() => {
      video.removeEventListener(event, done)
      video.removeEventListener('error', fail)
      reject(new Error(`영상 이벤트 시간 초과: ${event}`))
    }, 30000)
    video.addEventListener(event, done, { once: true })
    video.addEventListener('error', fail, { once: true })
  })
  try {
    const loaded = wait('loadeddata')
    video.src = url
    await loaded
    // MediaRecorder의 합성 WebM은 처음에 길이가 무한대로 표시될 수 있다.
    if (!Number.isFinite(video.duration)) {
      const sought = wait('seeked')
      video.currentTime = 1e10
      await sought
    }
    if (!(Number.isFinite(video.duration) && video.duration > 0)) throw new Error('영상 길이를 확인할 수 없습니다')
    let ema = null
    let presence = NO_PRESENCE
    const frames = []
    for (let t = 0; t < video.duration; t += 0.25) {
      if (video.currentTime !== t) {
        const sought = wait('seeked')
        video.currentTime = t
        await sought
      }
      // 검출기 시각은 영상이 바뀌어도 단조 증가시킨다.
      window.blazeTime = (window.blazeTime ?? 0) + 250
      const found = blaze.detectForVideo(video, window.blazeTime).detections[0]
      const box = found?.boundingBox
      const raw = box ? await expressionsFromBox(video, {
        x: box.originX - box.width * 0.1, y: box.originY - box.height * 0.1,
        w: box.width * 1.2, h: box.height * 1.2,
      }, video.videoWidth, video.videoHeight, found.categories[0]?.score ?? 0) : null
      presence = nextPresence(presence, Boolean(raw))
      const normalized = raw ? normalizeExpressions(raw) : null
      if (normalized) ema = smoothEmotion(ema, normalized)
      else if (!presence.present) ema = null
      frames.push({ t, duration: video.duration, faceDetected: Boolean(box), raw: raw ? Object.fromEntries(
        ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'].map((key) => [key, raw[key]]),
      ) : null, normalized, smoothed: ema, dominant: ema ? getDominantEmotion(ema) : null })
    }
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, backend: faceapi.tf.getBackend(), frames }
  } finally {
    video.removeAttribute('src')
    video.load()
    video.remove()
  }
}
