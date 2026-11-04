import type { RefObject } from 'react'
import type { CameraRotation } from '@/shared/storage/cameraRotation'
import { useMeRppg, type EngineFace } from '@/features/rppg/engine/useMeRppg'
import { RPPG_STATUS_TEXT, type RppgReading } from '@/features/rppg/engine/rppgGate'

/**
 * 측정 화면의 심박 원천. 같은 카메라 영상에서 감정 분석(face-api)과 함께 ME-rPPG 엔진을 돌린다.
 * 품질 게이트(features/rppg/engine/rppgGate.ts)를 넘은 동안에만 bpm 이 있고, 그 밖에는 null("--")이다.
 * 모의 신호는 만들지 않는다.
 */
export interface HeartRateSource {
  /** 현재 심박(BPM). 원천이 없거나 게이트를 못 넘으면 null */
  bpm: number | null
  /** 매 프레임 읽는 맥박 파형 값(0~1, 시각화 전용). 게이트를 못 넘으면 0 */
  getPulse: () => number
  /** 엔진 상태와 SNR. 화면에 사유를 보여줄 때 쓴다 */
  reading: RppgReading
  /** 엔진이 마지막 프레임에서 찾은 얼굴(감정 분석이 같은 상자를 쓴다) */
  getFace: () => EngineFace
  /** 최근 10초 얼굴 검출률(0~1) */
  getFaceRate: () => number | null
}

/** 맥박이 없을 때의 파형. 오브는 두근거리지 않고 파형은 평평하다. */
export const NO_PULSE = (): number => 0

/** 측정 화면의 심박 원천. enabled 가 false 이면 엔진을 돌리지 않는다. */
export function useHeartRateSource(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  rotation: CameraRotation = 0,
): HeartRateSource {
  const { reading, getPulse, getFace, getFaceRate } = useMeRppg(videoRef, enabled, { rotation })
  return { bpm: reading.bpm, getPulse, reading, getFace, getFaceRate }
}

/** bpm 을 화면 글자로. 값이 없으면 "--" */
export function bpmText(bpm: number | null): string {
  return bpm === null ? '--' : String(Math.round(bpm))
}

/** 파형 칸 표지: 상태와, 신호가 있으면 SNR */
export function pulseTag(reading: RppgReading): string {
  if (reading.status === 'live' && reading.snrDb !== null) return `맥박 파형 · rPPG · SNR ${reading.snrDb.toFixed(1)}dB`
  return `맥박 파형 · rPPG ${RPPG_STATUS_TEXT[reading.status]}`
}

/** 상태 행 글: 상태와, 추정이 있으면 SNR */
export function signalText(reading: RppgReading): string {
  const status = RPPG_STATUS_TEXT[reading.status]
  return reading.snrDb !== null && reading.status !== 'off' ? `${status} · SNR ${reading.snrDb.toFixed(1)}dB` : status
}
