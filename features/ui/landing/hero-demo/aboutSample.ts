import type { Emotion } from '@/features/algorithm/emotion/emotionAnalysis'
import type { DemoSession, TimelinePoint } from '@/features/ui/measure/demo/sessionLog'

/** 결정적 난수(mulberry32). 예시 측정이 열 때마다 같은 모양이 되게 한다. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 소개 장면(히어로 아래)의 결과 차트 연출용 예시 측정. 7분 12초, 중반에 심박이 오른다.
 * rPPG 를 붙였을 때 결과 화면이 어떻게 보일지 보여주는 그림이며, 실제 측정·결과 화면에서는 쓰지 않는다.
 */
export function makeAboutSampleSession(): DemoSession {
  const duration = 432
  const rand = mulberry32(7)
  const samples: TimelinePoint[] = []
  let bpm = 74
  for (let t = 0; t <= duration; t += 1) {
    const f = t / duration
    let emotion: Emotion = 'calm'
    if (f >= 0.2 && f < 0.28) emotion = 'happy'
    else if (f >= 0.3 && f < 0.57) emotion = 'angry'
    else if (f >= 0.57 && f < 0.7) emotion = 'sad'
    // 화남 구간 한가운데 잠깐 평온이 끼어든다(안정화가 걸러내지 못한 짧은 전환).
    if (f >= 0.41 && f < 0.43) emotion = 'calm'
    // 심박: 기본 74, 가운데가 108 근처.
    const hump = Math.exp(-(((f - 0.47) / 0.11) ** 2)) * 34
    bpm += (74 + hump - bpm) * 0.25 + (rand() - 0.5) * 2.4
    samples.push({ t, bpm: Math.round(bpm), emotion })
  }
  // 시각은 쓰지 않으므로 고정값. 렌더 중 호출해도 순수하다.
  return { startedAt: 0, endedAt: duration * 1000, durationSec: duration, samples }
}
