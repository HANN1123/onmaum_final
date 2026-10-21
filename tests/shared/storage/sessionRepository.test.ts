import { describe, it, expect, beforeEach } from 'vitest'
import { db, type EmotionRecord } from '@/shared/storage/db'
import {
  startSession,
  touchSession,
  endSession,
  recoverInterruptedSessions,
  getSessionsByDateRange,
  getSessionDetail,
  STALE_SESSION_MS,
} from '@/shared/storage/sessionRepository'

const T0 = new Date('2026-10-21T10:00:00')
const at = (ms: number) => new Date(T0.getTime() + ms)
const MIN = 60 * 1000

function emotion(timestamp: Date, sessionId?: string): Omit<EmotionRecord, 'id'> {
  return {
    timestamp,
    duration: 60000,
    detectionRate: 1,
    happy: 0.2,
    calm: 0.5,
    sad: 0.2,
    angry: 0.1,
    dominantEmotion: 'calm',
    flatAffectScore: 0.8,
    ...(sessionId ? { sessionId } : {}),
  }
}

beforeEach(async () => {
  await db.sessions.clear()
  await db.emotions.clear()
})

describe('startSession', () => {
  it('active 세션을 만들고 저장한다', async () => {
    const s = await startSession(T0)
    expect(s.status).toBe('active')
    expect(s.startedAt).toEqual(T0)
    expect(s.lastSeenAt).toEqual(T0)
    expect(s.endedAt).toBeNull()
    expect(s.endReason).toBeNull()
    expect(typeof s.id).toBe('string')
    expect(await db.sessions.get(s.id)).toEqual(s)
  })

  it('시작 직전에 오래된 active 세션을 복구한다', async () => {
    const old = await startSession(T0)
    await startSession(at(STALE_SESSION_MS + MIN))
    const recovered = await db.sessions.get(old.id)
    expect(recovered?.status).toBe('interrupted')
    expect(recovered?.endReason).toBe('recovered')
  })
})

describe('endSession', () => {
  it('active 세션을 completed로 끝낸다', async () => {
    const s = await startSession(T0)
    await endSession(s.id, 'user-stop', at(5 * MIN))
    const ended = await db.sessions.get(s.id)
    expect(ended?.status).toBe('completed')
    expect(ended?.endedAt).toEqual(at(5 * MIN))
    expect(ended?.endReason).toBe('user-stop')
  })

  it('중복 종료는 무시한다', async () => {
    const s = await startSession(T0)
    await endSession(s.id, 'user-stop', at(5 * MIN))
    await endSession(s.id, 'camera-error', at(9 * MIN))
    const ended = await db.sessions.get(s.id)
    expect(ended?.endedAt).toEqual(at(5 * MIN))
    expect(ended?.endReason).toBe('user-stop')
  })

  it('자동 복구된 세션도 사용자가 끝내면 completed로 확정한다', async () => {
    const s = await startSession(T0)
    await recoverInterruptedSessions(at(STALE_SESSION_MS + MIN))
    await endSession(s.id, 'user-stop', at(4 * MIN))
    const ended = await db.sessions.get(s.id)
    expect(ended?.status).toBe('completed')
    expect(ended?.endReason).toBe('user-stop')
  })

  it('없는 세션 id는 오류 없이 무시한다', async () => {
    await expect(endSession('missing', 'user-stop', T0)).resolves.toBeUndefined()
  })
})

describe('touchSession', () => {
  it('active 세션의 lastSeenAt을 갱신한다', async () => {
    const s = await startSession(T0)
    await touchSession(s.id, at(30 * 1000))
    expect((await db.sessions.get(s.id))?.lastSeenAt).toEqual(at(30 * 1000))
  })

  it('잘못 복구된 세션은 다음 갱신 때 active로 되돌린다', async () => {
    const s = await startSession(T0)
    await recoverInterruptedSessions(at(STALE_SESSION_MS + MIN))
    await touchSession(s.id, at(STALE_SESSION_MS + 2 * MIN))
    const revived = await db.sessions.get(s.id)
    expect(revived?.status).toBe('active')
    expect(revived?.endedAt).toBeNull()
    expect(revived?.endReason).toBeNull()
  })

  it('completed 세션은 늦게 도착한 갱신으로 되살리지 않는다', async () => {
    const s = await startSession(T0)
    await recoverInterruptedSessions(at(STALE_SESSION_MS + MIN))
    await endSession(s.id, 'user-stop', at(4 * MIN))
    await touchSession(s.id, at(5 * MIN))
    expect((await db.sessions.get(s.id))?.status).toBe('completed')
  })
})

describe('recoverInterruptedSessions', () => {
  it('lastSeenAt이 STALE_SESSION_MS보다 오래된 active 세션만 interrupted로 바꾼다', async () => {
    // startSession은 시작 전에 복구를 실행하므로, 두 세션을 직접 넣어 한 번의 복구만 검사한다
    const stale = { id: 'stale', startedAt: T0, endedAt: null, status: 'active' as const, endReason: null, lastSeenAt: T0 }
    const fresh = { ...stale, id: 'fresh', startedAt: at(3 * MIN), lastSeenAt: at(3 * MIN) }
    await db.sessions.bulkAdd([stale, fresh])
    const result = await recoverInterruptedSessions(at(3 * MIN + 30 * 1000))

    const s1 = await db.sessions.get(stale.id)
    expect(s1?.status).toBe('interrupted')
    expect(s1?.endedAt).toEqual(T0)
    expect((await db.sessions.get(fresh.id))?.status).toBe('active')
    expect(result.recovered).toBe(1)
  })

  it('아직 신선한 active 세션이 있으면 다시 검사할 시각을 알려 준다', async () => {
    const fresh = await startSession(T0)
    const result = await recoverInterruptedSessions(at(30 * 1000))
    expect(result.recovered).toBe(0)
    expect(result.nextCheckAt).toEqual(at(STALE_SESSION_MS + 1))
    await touchSession(fresh.id, at(MIN))
    const later = await recoverInterruptedSessions(at(MIN + 10 * 1000))
    expect(later.nextCheckAt).toEqual(at(MIN + STALE_SESSION_MS + 1))
  })

  it('중단 직후 재접속해도 재검사 시각에 복구된다', async () => {
    const s = await startSession(T0)
    const first = await recoverInterruptedSessions(at(MIN))
    expect((await db.sessions.get(s.id))?.status).toBe('active')
    await recoverInterruptedSessions(first.nextCheckAt!)
    expect((await db.sessions.get(s.id))?.status).toBe('interrupted')
  })

  it('active 세션이 없으면 nextCheckAt은 null', async () => {
    expect((await recoverInterruptedSessions(T0)).nextCheckAt).toBeNull()
  })
})

describe('조회', () => {
  it('startedAt 기준으로 기간 안의 세션을 시작 순서로 반환한다', async () => {
    const a = await startSession(new Date('2026-10-20T23:50:00'))
    const b = await startSession(new Date('2026-10-21T09:00:00'))
    const c = await startSession(new Date('2026-10-21T14:00:00'))
    await startSession(new Date('2026-10-22T09:00:00'))

    const list = await getSessionsByDateRange(
      new Date('2026-10-21T00:00:00'),
      new Date('2026-10-21T23:59:59.999'),
    )
    expect(list.map((s) => s.id)).toEqual([b.id, c.id])
    expect(list.map((s) => s.id)).not.toContain(a.id)
  })

  it('세션 상세는 연결된 감정 기록만 시간순으로 포함한다', async () => {
    const s = await startSession(T0)
    const other = await startSession(T0)
    await db.emotions.bulkAdd([
      emotion(at(2 * MIN), s.id),
      emotion(at(MIN), s.id),
      emotion(at(MIN), other.id),
      emotion(at(MIN)),
    ] as EmotionRecord[])

    const detail = await getSessionDetail(s.id)
    expect(detail?.session.id).toBe(s.id)
    expect(detail?.emotions.map((e) => e.timestamp)).toEqual([at(MIN), at(2 * MIN)])
  })

  it('없는 세션의 상세는 null', async () => {
    expect(await getSessionDetail('missing')).toBeNull()
  })
})
