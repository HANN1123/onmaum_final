'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { connectHeartRateMonitor, type HeartRateConnection } from '@/features/rppg/lib/heartRateMonitor'
import type { ReferenceSample } from '@/features/rppg/lib/rppg'

/** 비교용 버퍼는 최근 값만 있으면 되고, 원시 기록은 시험 뒤 내보낼 수 있게 더 오래 둔다 */
const MAX_SAMPLES = 200
const MAX_RAW_LOG = 20_000

type Status = 'idle' | 'connecting' | 'connected'

export function useHeartRateDevice() {
  const [supported, setSupported] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [latest, setLatest] = useState<ReferenceSample | null>(null)
  const [error, setError] = useState<string | null>(null)

  const samplesRef = useRef<ReferenceSample[]>([])
  const rawLogRef = useRef<ReferenceSample[]>([])
  const connectionRef = useRef<HeartRateConnection | null>(null)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof navigator !== 'undefined' && 'bluetooth' in navigator)
    return () => {
      unmountedRef.current = true
      connectionRef.current?.disconnect()
      connectionRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    samplesRef.current = []
    setLatest(null)
  }, [])

  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect()
    connectionRef.current = null
    reset()
    setStatus('idle')
    setDeviceName(null)
  }, [reset])

  const connect = useCallback(async () => {
    if (status !== 'idle') return
    setError(null)
    setStatus('connecting')
    reset()
    try {
      const connection = await connectHeartRateMonitor(
        (sample) => {
          samplesRef.current = [...samplesRef.current, sample].slice(-MAX_SAMPLES)
          rawLogRef.current.push(sample)
          if (rawLogRef.current.length > MAX_RAW_LOG) rawLogRef.current.shift()
          setLatest(sample)
        },
        () => {
          connectionRef.current = null
          reset()
          setStatus('idle')
          setDeviceName(null)
          setError('심박 기기 연결이 끊겼어요')
        },
      )
      // 선택창이 열린 사이 화면을 떠났으면 연결을 남기지 않는다
      if (unmountedRef.current) {
        connection.disconnect()
        return
      }
      connectionRef.current = connection
      setDeviceName(connection.name)
      setStatus('connected')
    } catch (err) {
      setStatus('idle')
      // 선택창을 닫은 것은 오류가 아니다
      if (err instanceof Error && err.name === 'NotFoundError') return
      setError(`심박 기기 연결 실패: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [status, reset])

  const getSamples = useCallback(() => samplesRef.current, [])
  const getRawLog = useCallback(() => rawLogRef.current, [])

  return { supported, status, deviceName, latest, error, getSamples, getRawLog, connect, disconnect }
}
