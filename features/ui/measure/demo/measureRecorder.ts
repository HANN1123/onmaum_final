import { aggregate, type EmotionSample } from '@/features/algorithm/emotion/emotionAggregator'
import type { EmotionResult } from '@/features/algorithm/emotion/emotionAnalysis'
import type { EmotionRecordInput } from '@/shared/storage/emotionRepository'
import type { SessionStopReason } from '@/shared/storage/sessionRepository'

/** 감정 기록 한 건이 묶는 시간. 원래 앱 레코더(useEmotionRecorder)와 같은 1분이다 */
export const RECORD_AGGREGATE_MS = 60_000
/** 세션 생존 시각 갱신 주기. sessionRepository.SESSION_HEARTBEAT_MS 와 같은 30초 */
export const RECORD_HEARTBEAT_MS = 30_000
/**
 * 표본 하나가 차지하는 시간의 상한. 검출이 밀리거나 탭이 잠깐 멈춰 간격이 벌어져도
 * 한 표본이 그 공백 전체를 대표하지 않게 한다(검출 비율·측정 시간이 부풀지 않는다).
 */
export const MAX_SAMPLE_GAP_MS = 1_000

export interface RecorderDeps {
  startSession: (now: Date) => Promise<{ id: string }>
  touchSession: (id: string, now: Date) => Promise<void>
  endSession: (id: string, reason: SessionStopReason, now: Date) => Promise<void>
  saveRecord: (record: EmotionRecordInput) => Promise<number>
  now: () => number
}

export interface RecorderStatus {
  /** 이번 측정에서 저장한 1분 기록 수 */
  saved: number
  /** 기록 저장이 한 번이라도 실패했는지 */
  failed: boolean
  /** 세션을 만들지 못했으면 null(기록은 세션 없이 저장한다) */
  sessionId: string | null
}

export interface MeasureRecorder {
  /** 검출 한 번의 결과(다듬기 전 감정 비율, 얼굴 없음은 null) */
  push: (emotion: EmotionResult | null) => void
  /** 남은 표본을 저장하고 세션을 끝낸다. 여러 번 불러도 한 번만 처리하고 같은 결과를 돌려준다 */
  stop: (reason?: SessionStopReason) => Promise<RecorderStatus>
  status: () => RecorderStatus
}

/**
 * 새 측정 화면의 1분 감정 기록 저장기. 얼굴 검출은 하지 않고 측정 화면이 이미 얻은 표본만 받는다(검출 1회).
 * - 시작하면 측정 세션을 만들고, 1분마다 표본을 aggregate 로 묶어 세션 id 와 함께 저장한다.
 * - 저장·세션 갱신은 한 줄로 차례대로 처리해 순서가 섞이지 않는다.
 * - stop 은 남은 표본까지 저장하고 세션을 끝낸 뒤 끝난다. 결과 화면으로 넘어가기 전에 기다릴 수 있다.
 * - 세션 생성이 실패해도 측정 기록은 세션 없이 저장한다(리포트 숫자는 유지되고 세션 목록에서만 빠진다).
 */
export function createMeasureRecorder(
  deps: RecorderDeps,
  { nominalIntervalMs, onChange, aggregateMs = RECORD_AGGREGATE_MS }: {
    /** 첫 표본처럼 앞 표본이 없을 때 쓰는 표본 간격 */
    nominalIntervalMs: number
    onChange?: (status: RecorderStatus) => void
    aggregateMs?: number
  },
): MeasureRecorder {
  const status: RecorderStatus = { saved: 0, failed: false, sessionId: null }
  const startedAt = deps.now()
  let buffer: EmotionSample[] = []
  let bufferStart = startedAt
  let lastSampleAt: number | null = null
  let lastTouch = startedAt
  let stopping: Promise<RecorderStatus> | null = null
  let queue: Promise<void> = Promise.resolve()

  const emit = () => onChange?.({ ...status })
  const enqueue = (job: () => Promise<void>) => {
    queue = queue.then(job, job)
  }

  const sessionReady = deps
    .startSession(new Date(startedAt))
    .then((session) => {
      status.sessionId = session.id
      emit()
    })
    .catch((err: unknown) => {
      console.error('측정 세션 생성 실패(기록은 세션 없이 저장):', err)
    })
  enqueue(() => sessionReady)

  const flush = (endMs: number) => {
    const samples = buffer
    buffer = []
    const record = aggregate(samples, new Date(endMs))
    if (!record) return
    enqueue(async () => {
      const input: EmotionRecordInput = status.sessionId ? { ...record, sessionId: status.sessionId } : record
      try {
        await deps.saveRecord(input)
        status.saved += 1
      } catch (err) {
        console.error('감정 기록 저장 실패:', err)
        status.failed = true
      }
      emit()
    })
  }

  return {
    push(emotion) {
      if (stopping) return
      const t = deps.now()
      const intervalMs = lastSampleAt === null ? nominalIntervalMs : Math.min(MAX_SAMPLE_GAP_MS, Math.max(0, t - lastSampleAt))
      lastSampleAt = t
      buffer.push({ emotion, intervalMs })
      if (t - bufferStart >= aggregateMs) {
        flush(t)
        bufferStart = t
      }
      if (t - lastTouch >= RECORD_HEARTBEAT_MS) {
        lastTouch = t
        enqueue(async () => {
          if (!status.sessionId) return
          await deps.touchSession(status.sessionId, new Date(t)).catch((err: unknown) => {
            console.error('측정 세션 갱신 실패:', err)
          })
        })
      }
    },
    stop(reason = 'user-stop') {
      if (stopping) return stopping
      const t = deps.now()
      flush(t)
      enqueue(async () => {
        if (!status.sessionId) return
        await deps.endSession(status.sessionId, reason, new Date(t)).catch((err: unknown) => {
          console.error('측정 세션 종료 실패:', err)
        })
      })
      stopping = queue.then(() => ({ ...status }))
      return stopping
    },
    status: () => ({ ...status }),
  }
}
