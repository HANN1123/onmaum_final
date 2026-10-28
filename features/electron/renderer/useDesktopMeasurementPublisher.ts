'use client'

import { useEffect, useRef } from 'react'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import type { DesktopEmotion, MeasurementSnapshot } from '@/features/electron/types/bridge'
import { useDesktopBridge } from './desktopBridge'

interface Options {
  active: boolean
  emotions: EmotionResult | null
  recordCount: number
  videoEl: HTMLVideoElement | null
  /** 레코더의 감정 기록 저장 실패 여부 */
  saveFailed: boolean
}

/** 측정 중 heartbeat 주기 */
export const HEARTBEAT_MS = 1000

const clampUnit = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))

function toDesktopEmotion(e: EmotionResult | null): DesktopEmotion | null {
  if (!e) return null
  return { happy: clampUnit(e.happy), calm: clampUnit(e.calm), sad: clampUnit(e.sad), angry: clampUnit(e.angry) }
}

/** 디코딩된 누적 프레임 수. 알 수 없으면 null */
function totalFrames(video: HTMLVideoElement | null): number | null {
  if (!video || typeof video.getVideoPlaybackQuality !== 'function') return null
  const n = video.getVideoPlaybackQuality().totalVideoFrames
  return Number.isFinite(n) ? n : null
}

/**
 * Electron에서 측정 상태를 메인 프로세스로 보낸다(위젯 표시용). 웹에서는 아무것도 하지 않는다.
 * 측정 흐름·레코더는 건드리지 않고 화면 상태만 읽는다.
 */
export function useDesktopMeasurementPublisher({
  active,
  emotions,
  recordCount,
  videoEl,
  saveFailed,
}: Options): void {
  const bridge = useDesktopBridge()
  const latest = useRef({ active, emotions, recordCount, saveFailed, videoFps: null as number | null })

  useEffect(() => {
    latest.current = { ...latest.current, active, emotions, recordCount, saveFailed }
  })

  useEffect(() => {
    if (!bridge) return
    bridge.publishMeasurement(buildSnapshot(latest.current))
  }, [bridge, active, emotions, recordCount, saveFailed])

  // 측정 중에는 1초마다 프레임 증가량과 함께 heartbeat를 보낸다.
  useEffect(() => {
    if (!bridge || !active) {
      latest.current.videoFps = null
      return
    }
    let prevFrames = totalFrames(videoEl)
    let prevAt = Date.now()
    const id = setInterval(() => {
      const frames = totalFrames(videoEl)
      const at = Date.now()
      const seconds = (at - prevAt) / 1000
      latest.current.videoFps =
        frames === null || prevFrames === null || seconds <= 0
          ? null
          : Math.max(0, Math.round((frames - prevFrames) / seconds))
      prevFrames = frames
      prevAt = at
      bridge.publishMeasurement(buildSnapshot(latest.current))
    }, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [bridge, active, videoEl])

  // 측정 화면을 떠나면 측정이 끝난 것으로 알린다.
  useEffect(() => {
    if (!bridge) return
    return () => {
      bridge.publishMeasurement({
        active: false,
        emotions: null,
        recordCount: latest.current.recordCount,
        videoFps: null,
        saveFailed: false,
        sentAt: Date.now(),
      })
    }
  }, [bridge])
}

function buildSnapshot(s: {
  active: boolean
  emotions: EmotionResult | null
  recordCount: number
  saveFailed: boolean
  videoFps: number | null
}): MeasurementSnapshot {
  return {
    active: s.active,
    emotions: toDesktopEmotion(s.emotions),
    recordCount: Math.max(0, Math.floor(s.recordCount)),
    videoFps: s.active ? s.videoFps : null,
    saveFailed: s.active && s.saveFailed,
    sentAt: Date.now(),
  }
}
