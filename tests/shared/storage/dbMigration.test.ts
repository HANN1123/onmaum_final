import { describe, it, expect, afterEach } from 'vitest'
import Dexie from 'dexie'
import { OnmaumDB, type EmotionRecord, type MeasurementSession } from '@/shared/storage/db'

type EmotionRecordInput = Omit<EmotionRecord, 'id'>

/** 버전 1 시절과 같은 schema만 선언한 DB. 실제 사용자 기기에 남아 있는 상태를 흉내 낸다. */
function openAsV1(name: string): Dexie {
  const v1 = new Dexie(name)
  v1.version(1).stores({ emotions: '++id, timestamp' })
  return v1
}

function legacyRecord(timestamp: string, overrides: Partial<EmotionRecordInput> = {}): EmotionRecordInput {
  return {
    timestamp: new Date(timestamp),
    duration: 60000,
    detectionRate: 1,
    happy: 0.2,
    calm: 0.5,
    sad: 0.2,
    angry: 0.1,
    dominantEmotion: 'calm',
    flatAffectScore: 0.8,
    ...overrides,
  }
}

const opened: Dexie[] = []
let seq = 0
function uniqueName(): string {
  seq += 1
  return `onmaum-migration-test-${seq}`
}

afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close()
    await Dexie.delete(d.name)
  }
})

describe('Dexie v1 → v2 확장', () => {
  it('v1 감정 기록이 그대로 보존되고 sessionId는 없다', async () => {
    const name = uniqueName()
    const v1 = openAsV1(name)
    await v1.table('emotions').bulkAdd([
      legacyRecord('2026-10-01T10:00:00'),
      legacyRecord('2026-10-01T10:01:00', { sad: 0.6, calm: 0.1 }),
    ])
    const before = await v1.table('emotions').toArray()
    v1.close()

    const v2 = new OnmaumDB(name)
    opened.push(v2)
    const after = await v2.emotions.toArray()

    expect(v2.verno).toBe(2)
    expect(after).toEqual(before)
    expect(after.every((r) => r.sessionId === undefined)).toBe(true)
  })

  it('v1 기록의 날짜 범위 조회 결과가 v2에서도 같다', async () => {
    const name = uniqueName()
    const v1 = openAsV1(name)
    await v1.table('emotions').bulkAdd([
      legacyRecord('2026-10-01T09:00:00'),
      legacyRecord('2026-10-02T09:00:00'),
      legacyRecord('2026-10-03T09:00:00'),
    ])
    const start = new Date('2026-10-02T00:00:00')
    const end = new Date('2026-10-02T23:59:59.999')
    const before = await v1.table('emotions').where('timestamp').between(start, end, true, true).toArray()
    v1.close()

    const v2 = new OnmaumDB(name)
    opened.push(v2)
    const after = await v2.emotions.where('timestamp').between(start, end, true, true).toArray()

    expect(after).toEqual(before)
    expect(after).toHaveLength(1)
  })

  it('세션 미연결 기록은 sessionId 인덱스 조회에 나타나지 않는다', async () => {
    const name = uniqueName()
    const v1 = openAsV1(name)
    await v1.table('emotions').add(legacyRecord('2026-10-01T10:00:00'))
    v1.close()

    const v2 = new OnmaumDB(name)
    opened.push(v2)
    await v2.emotions.add({ ...legacyRecord('2026-10-01T11:00:00'), sessionId: 's-1' } as EmotionRecord)

    const linked = await v2.emotions.where('sessionId').equals('s-1').toArray()
    const all = await v2.emotions.count()

    expect(linked).toHaveLength(1)
    expect(all).toBe(2)
    expect(await v2.emotions.where('sessionId').above('').count()).toBe(1)
  })

  it('sessions 테이블에 세션을 저장하고 시작 시각·상태로 조회할 수 있다', async () => {
    const v2 = new OnmaumDB(uniqueName())
    opened.push(v2)
    const session: MeasurementSession = {
      id: 'session-a',
      startedAt: new Date('2026-10-01T10:00:00'),
      endedAt: null,
      status: 'active',
      endReason: null,
      lastSeenAt: new Date('2026-10-01T10:00:00'),
    }
    await v2.sessions.add(session)

    expect(await v2.sessions.get('session-a')).toEqual(session)
    expect(await v2.sessions.where('status').equals('active').count()).toBe(1)
    expect(
      await v2.sessions
        .where('startedAt')
        .between(new Date('2026-10-01T00:00:00'), new Date('2026-10-01T23:59:59.999'), true, true)
        .count(),
    ).toBe(1)
  })

  it('이전 코드가 v1으로 연 다른 탭이 있어도 v2 업그레이드가 끝나고 기록이 보존된다', async () => {
    const name = uniqueName()
    const otherTab = openAsV1(name)
    opened.push(otherTab)
    await otherTab.table('emotions').add(legacyRecord('2026-10-01T10:00:00'))
    expect(otherTab.isOpen()).toBe(true)

    const v2 = new OnmaumDB(name)
    opened.push(v2)
    await v2.open()

    expect(v2.verno).toBe(2)
    expect(await v2.emotions.count()).toBe(1)
    // Dexie 기본 동작: versionchange를 받은 이전 연결은 스스로 닫혀 업그레이드를 막지 않는다
    expect(otherTab.isOpen()).toBe(false)
  })

  it('v2 DB를 v1 schema만 아는 이전 코드로 열어도 감정 기록을 읽고 쓸 수 있다', async () => {
    const name = uniqueName()
    const v2 = new OnmaumDB(name)
    await v2.emotions.add(legacyRecord('2026-10-01T10:00:00') as EmotionRecord)
    v2.close()

    const oldCode = openAsV1(name)
    opened.push(oldCode)
    await oldCode.table('emotions').add(legacyRecord('2026-10-01T10:01:00'))

    expect(await oldCode.table('emotions').count()).toBe(2)
  })
})
