import { db, type EmotionRecord, type MeasurementSession, type SessionEndReason } from './db'

/** 측정 중 생존 시각(lastSeenAt)을 갱신하는 주기. 호출하는 쪽의 타이머가 쓴다 */
export const SESSION_HEARTBEAT_MS = 30 * 1000

/** 생존 갱신이 이보다 오래 없으면 비정상 종료로 본다 (갱신 주기의 4배) */
export const STALE_SESSION_MS = 4 * SESSION_HEARTBEAT_MS

/** 사용자 조작이나 오류로 끝내는 이유. 'recovered'는 복구 처리만 쓴다 */
export type SessionStopReason = Exclude<SessionEndReason, 'recovered'>

export interface RecoverResult {
  /** 이번에 interrupted로 바꾼 세션 수 */
  recovered: number
  /** 아직 신선해서 남겨 둔 active 세션을 다시 검사할 시각. 없으면 null */
  nextCheckAt: Date | null
}

export interface SessionDetail {
  session: MeasurementSession
  emotions: EmotionRecord[]
}

function isAutoRecovered(s: MeasurementSession): boolean {
  return s.status === 'interrupted' && s.endReason === 'recovered'
}

/**
 * 세션 id(UUID v4). crypto.randomUUID는 보안 컨텍스트(HTTPS·localhost)에서만 있으므로,
 * 없으면 보안 컨텍스트가 아니어도 쓸 수 있는 getRandomValues로 만든다.
 */
export function newSessionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * 오래 갱신되지 않은 active 세션을 interrupted로 정리한다.
 * 앱 시작 시, startSession 직전, 그리고 반환된 nextCheckAt에 호출한다.
 * 다른 탭에서 측정 중인 세션은 lastSeenAt이 계속 갱신되므로 건드리지 않는다.
 */
export async function recoverInterruptedSessions(
  now: Date = new Date(),
  staleMs: number = STALE_SESSION_MS,
): Promise<RecoverResult> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await db.sessions.where('status').equals('active').toArray()
    let recovered = 0
    let earliestFresh: number | null = null
    for (const s of active) {
      const seen = s.lastSeenAt.getTime()
      if (now.getTime() - seen > staleMs) {
        await db.sessions.update(s.id, {
          status: 'interrupted',
          endedAt: s.lastSeenAt,
          endReason: 'recovered',
        })
        recovered += 1
      } else if (earliestFresh === null || seen < earliestFresh) {
        earliestFresh = seen
      }
    }
    return {
      recovered,
      nextCheckAt: earliestFresh === null ? null : new Date(earliestFresh + staleMs + 1),
    }
  })
}

/** 새 측정 세션을 만든다. 만들기 전에 남아 있는 비정상 종료 세션을 정리한다 */
export async function startSession(
  now: Date = new Date(),
  id: string = newSessionId(),
): Promise<MeasurementSession> {
  await recoverInterruptedSessions(now)
  const session: MeasurementSession = {
    id,
    startedAt: now,
    endedAt: null,
    status: 'active',
    endReason: null,
    lastSeenAt: now,
  }
  await db.sessions.add(session)
  return session
}

/**
 * 측정 중인 세션의 생존 시각을 갱신한다. 감정 기록 저장 여부와 무관하게 주기적으로 호출한다.
 * 잘못 복구된 세션(interrupted + 'recovered')은 active로 되돌린다. completed는 되살리지 않는다.
 * 늦게 처리된 갱신이 시각을 뒤로 돌리지 않도록, 이미 저장된 lastSeenAt보다 이른 갱신은 무시한다.
 */
export async function touchSession(id: string, now: Date = new Date()): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    if (now.getTime() <= s.lastSeenAt.getTime()) return
    if (s.status === 'active') {
      await db.sessions.update(id, { lastSeenAt: now })
    } else if (isAutoRecovered(s)) {
      await db.sessions.update(id, { status: 'active', endedAt: null, endReason: null, lastSeenAt: now })
    }
  })
}

/**
 * 세션을 끝낸다. active이거나 자동 복구된 세션이면 completed로 확정한다.
 * 이미 completed인 세션은 그대로 둔다(중복 종료 무시). 호출 전에 생존 갱신 타이머를 먼저 멈춘다.
 */
export async function endSession(
  id: string,
  reason: SessionStopReason,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    if (s.status === 'active' || isAutoRecovered(s)) {
      await db.sessions.update(id, { status: 'completed', endedAt: now, endReason: reason })
    }
  })
}

/** 시작 시각이 [start, end] 안에 있는 세션을 시작 순서로 반환한다 (일별·주별 목록) */
export async function getSessionsByDateRange(start: Date, end: Date): Promise<MeasurementSession[]> {
  return db.sessions.where('startedAt').between(start, end, true, true).sortBy('startedAt')
}

/** 세션과 그 세션에 연결된 감정 기록(시간순). 세션이 없으면 null */
export async function getSessionDetail(id: string): Promise<SessionDetail | null> {
  const session = await db.sessions.get(id)
  if (!session) return null
  const emotions = await db.emotions.where('sessionId').equals(id).sortBy('timestamp')
  return { session, emotions }
}
