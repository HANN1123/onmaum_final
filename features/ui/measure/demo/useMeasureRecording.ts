'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { addEmotionRecord } from '@/shared/storage/emotionRepository'
import { endSession, startSession, touchSession } from '@/shared/storage/sessionRepository'
import { createMeasureRecorder, type MeasureRecorder, type RecorderDeps, type RecorderStatus } from './measureRecorder'

/** 세션 생존 갱신을 확인하는 간격. 실제 갱신은 recorder 가 30초(RECORD_HEARTBEAT_MS)마다 한 번만 한다 */
export const KEEP_ALIVE_TICK_MS = 5_000

const STORAGE_DEPS: RecorderDeps = {
  startSession: (now) => startSession(now),
  touchSession,
  endSession,
  saveRecord: addEmotionRecord,
  now: () => Date.now(),
}

interface Result {
  /** useFaceTrack 의 onSample 로 넘긴다. 저장 중이 아니면 무시한다 */
  push: (emotion: EmotionResult | null) => void
  /** 남은 기록을 저장하고 세션을 끝낸다. 저장 중이 아니었으면 바로 null */
  stop: () => Promise<RecorderStatus | null>
  /** 이번 측정의 저장 상태. 저장하지 않는 동안 null */
  status: RecorderStatus | null
}

/**
 * enabled(측정 중이고 저장에 동의함) 동안 1분 감정 기록을 이 기기에 저장한다.
 * enabled 가 꺼지거나 화면을 떠나면 남은 표본까지 저장하고 세션을 끝낸다(기다리지 않는다).
 * 측정 종료 버튼은 stop 을 기다린 뒤 결과 화면으로 가서, 리포트가 방금 측정을 바로 읽는다.
 * paused(호흡 안내 중) 동안은 표본을 받지 않되, 그 전 표본은 멈춘 시각으로 저장하고 세션 생존 갱신은 계속한다.
 */
export function useMeasureRecording(
  enabled: boolean,
  { nominalIntervalMs, paused = false, deps = STORAGE_DEPS }: { nominalIntervalMs: number; paused?: boolean; deps?: RecorderDeps },
): Result {
  const recorderRef = useRef<MeasureRecorder | null>(null)
  const [status, setStatus] = useState<RecorderStatus | null>(null)
  const pausedRef = useRef(paused)

  useEffect(() => {
    if (!enabled) return
    const recorder = createMeasureRecorder(deps, { nominalIntervalMs, onChange: setStatus })
    recorderRef.current = recorder
    // 호흡 안내 중에 측정이 시작돼도 멈춘 상태로 시작한다
    if (pausedRef.current) recorder.pause()
    // 표본이 끊겨도(호흡 안내, 검출 지연) 세션이 측정 중으로 보이도록 생존 갱신을 따로 돌린다
    const keepAlive = setInterval(() => recorder.keepAlive(), KEEP_ALIVE_TICK_MS)
    // 새 측정의 저장 상태로 바로 바꾼다(enabled 가 바뀔 때만 실행된다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(recorder.status())
    return () => {
      clearInterval(keepAlive)
      if (recorderRef.current === recorder) recorderRef.current = null
      void recorder.stop()
    }
  }, [enabled, nominalIntervalMs, deps])

  useEffect(() => {
    pausedRef.current = paused
    if (paused) recorderRef.current?.pause()
    else recorderRef.current?.resume()
  }, [paused])

  const push = useCallback((emotion: EmotionResult | null) => {
    recorderRef.current?.push(emotion)
  }, [])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    return recorder ? recorder.stop() : null
  }, [])

  return { push, stop, status }
}
