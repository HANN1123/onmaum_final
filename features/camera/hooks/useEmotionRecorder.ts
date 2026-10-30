'use client'

import { useEffect, useRef, useState } from 'react'
import { analyzeEmotion as defaultAnalyzeEmotion } from '@/features/camera/lib/faceDetection'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import { aggregate, type EmotionSample } from '@/features/algorithm/emotion/emotionAggregator'
import {
  addEmotionRecord as defaultAddEmotionRecord,
  type EmotionRecordInput,
} from '@/shared/storage/emotionRepository'

interface Options {
  active: boolean
  videoEl: HTMLVideoElement | null
  intervalMs?: number
  aggregateMs?: number
  /** 테스트 주입용. production은 디폴트 사용. */
  analyze?: (video: HTMLVideoElement) => Promise<EmotionResult | null>
  /** 테스트 주입용. production은 디폴트 사용. */
  saveRecord?: (record: EmotionRecordInput) => Promise<number>
}

interface Result {
  currentEmotion: EmotionResult | null
  saveError: Error | null
}

const DEFAULT_INTERVAL_MS = 500
const DEFAULT_AGGREGATE_MS = 60000

export function useEmotionRecorder(opts: Options): Result {
  const {
    active,
    videoEl,
    intervalMs = DEFAULT_INTERVAL_MS,
    aggregateMs = DEFAULT_AGGREGATE_MS,
    analyze = defaultAnalyzeEmotion,
    saveRecord = defaultAddEmotionRecord,
  } = opts

  const [currentEmotion, setCurrentEmotion] = useState<EmotionResult | null>(null)
  const [saveError, setSaveError] = useState<Error | null>(null)

  const bufferRef = useRef<EmotionSample[]>([])
  const bufferStartRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fnRef = useRef({ analyze, saveRecord })

  useEffect(() => {
    fnRef.current = { analyze, saveRecord }
  })

  useEffect(() => {
    videoRef.current = videoEl
  }, [videoEl])

  useEffect(() => {
    if (!active || !videoEl) {
      const samples = bufferRef.current
      bufferRef.current = []
      if (samples.length > 0) {
        const record = aggregate(samples, new Date())
        if (record) {
          fnRef.current.saveRecord(record).catch((err: unknown) => {
            const error = err instanceof Error ? err : new Error(String(err))
            console.error('감정 기록 저장 실패:', error)
            setSaveError(error)
          })
        }
      }
      // active=false 전환 시 UI 즉시 정리. cascading render 아님 (active 변할 때만).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentEmotion(null)
      return
    }

    setSaveError(null)
    bufferRef.current = []
    bufferStartRef.current = Date.now()
    // 실행마다 따로 두는 상태. 빠르게 중지·재시작해도 이전 실행의 분석 결과·예약 타이머가 새 실행에 섞이지 않는다.
    let running = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const flushBuffer = async (endTime: Date): Promise<void> => {
      const samples = bufferRef.current
      bufferRef.current = []
      if (samples.length === 0) return
      const record = aggregate(samples, endTime)
      if (!record) return
      try {
        await fnRef.current.saveRecord(record)
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('감정 기록 저장 실패:', error)
        setSaveError(error)
      }
    }

    const tick = async (): Promise<void> => {
      timer = null
      if (!running) return

      const video = videoRef.current
      let result: EmotionResult | null = null
      if (video && video.readyState >= 2) {
        try {
          result = await fnRef.current.analyze(video)
        } catch (err) {
          console.error('감정 분석 실패:', err)
          result = null
        }
      }
      if (!running) return

      bufferRef.current.push({ emotion: result, intervalMs })
      setCurrentEmotion(result)

      if (Date.now() - bufferStartRef.current >= aggregateMs) {
        await flushBuffer(new Date())
        bufferStartRef.current = Date.now()
      }

      if (running) {
        timer = setTimeout(tick, intervalMs)
      }
    }
    void tick()

    return () => {
      running = false
      if (timer !== null) clearTimeout(timer)
      void flushBuffer(new Date())
    }
  }, [active, videoEl, intervalMs, aggregateMs])

  return { currentEmotion, saveError }
}
