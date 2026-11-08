'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { addEmotionRecord } from '@/shared/storage/emotionRepository'
import { endSession, startSession, touchSession } from '@/shared/storage/sessionRepository'
import { createMeasureRecorder, type MeasureRecorder, type RecorderDeps, type RecorderStatus } from './measureRecorder'

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
 */
export function useMeasureRecording(
  enabled: boolean,
  { nominalIntervalMs, deps = STORAGE_DEPS }: { nominalIntervalMs: number; deps?: RecorderDeps },
): Result {
  const recorderRef = useRef<MeasureRecorder | null>(null)
  const [status, setStatus] = useState<RecorderStatus | null>(null)

  useEffect(() => {
    if (!enabled) return
    const recorder = createMeasureRecorder(deps, { nominalIntervalMs, onChange: setStatus })
    recorderRef.current = recorder
    // 새 측정의 저장 상태로 바로 바꾼다(enabled 가 바뀔 때만 실행된다)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(recorder.status())
    return () => {
      if (recorderRef.current === recorder) recorderRef.current = null
      void recorder.stop()
    }
  }, [enabled, nominalIntervalMs, deps])

  const push = useCallback((emotion: EmotionResult | null) => {
    recorderRef.current?.push(emotion)
  }, [])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    return recorder ? recorder.stop() : null
  }, [])

  return { push, stop, status }
}
