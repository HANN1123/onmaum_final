import { describe, it, expect, beforeEach } from 'vitest'
import { db, type EmotionRecord, type MeasurementSession } from '@/shared/storage/db'
import {
  exportPersonalData,
  serializeExport,
  MeasurementActiveError,
  EXPORT_SCHEMA_VERSION,
} from '@/shared/storage/personalData'
import {
  parsePersonalDataImport,
  importPersonalData,
  ImportFormatError,
  MAX_IMPORT_BYTES,
} from '@/shared/storage/personalImport'
import { loadSettings, saveSettings, DEFAULT_SETTINGS, SETTINGS_KEY } from '@/shared/storage/settings'

const NOW = new Date('2026-10-28T12:00:00')

function emotion(timestamp: string, sessionId?: string): EmotionRecord {
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
    ...(sessionId ? { sessionId } : {}),
  } as EmotionRecord
}

function session(id: string, startedAt: string, o: Partial<MeasurementSession> = {}): MeasurementSession {
  const t = new Date(startedAt)
  return {
    id,
    startedAt: t,
    endedAt: new Date(t.getTime() + 10 * 60000),
    status: 'completed',
    endReason: 'user-stop',
    lastSeenAt: new Date(t.getTime() + 10 * 60000),
    ...o,
  }
}

/** 내보내기 파일과 같은 모양의 JSON 문자열 */
function file(o: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: NOW.toISOString(),
    emotions: [],
    sessions: [],
    localData: {},
    ...o,
  })
}

async function clearAll() {
  await db.emotions.clear()
  await db.sessions.clear()
  localStorage.clear()
}

beforeEach(clearAll)

describe('내보내기 → 가져오기', () => {
  it('다른 기기(빈 저장소)로 옮기면 기록·세션·설정이 그대로 복원된다', async () => {
    await db.sessions.add(session('s1', '2026-10-27T09:00:00'))
    await db.emotions.bulkAdd([emotion('2026-10-27T09:01:00', 's1'), emotion('2026-10-27T09:02:00', 's1')])
    saveSettings({ ...DEFAULT_SETTINGS, calibrationOffset: 6 })
    localStorage.setItem('onmaum_onboarded', 'true')
    localStorage.setItem('onmaum_checkin_2026-10-27', JSON.stringify({ done: ['morning'] }))
    const text = serializeExport(await exportPersonalData(NOW))

    await clearAll()
    const summary = await importPersonalData(parsePersonalDataImport(text, NOW), NOW)

    expect(summary.emotions).toEqual({ added: 2, duplicate: 0, invalid: 0 })
    expect(summary.sessions).toEqual({ added: 1, duplicate: 0, invalid: 0 })
    expect(summary.localKeys.added).toBe(3)
    const emotions = await db.emotions.orderBy('timestamp').toArray()
    expect(emotions.map((e) => e.timestamp.getTime())).toEqual([
      new Date('2026-10-27T09:01:00').getTime(),
      new Date('2026-10-27T09:02:00').getTime(),
    ])
    expect(emotions[0].timestamp).toBeInstanceOf(Date)
    expect(emotions[0].sessionId).toBe('s1')
    const s = await db.sessions.get('s1')
    expect(s?.startedAt).toBeInstanceOf(Date)
    expect(loadSettings().calibrationOffset).toBe(6)
    expect(localStorage.getItem('onmaum_onboarded')).toBe('true')
  })

  it('같은 파일을 두 번 가져와도 기록이 늘지 않는다', async () => {
    await db.sessions.add(session('s1', '2026-10-27T09:00:00'))
    await db.emotions.add(emotion('2026-10-27T09:01:00', 's1'))
    const text = serializeExport(await exportPersonalData(NOW))

    const summary = await importPersonalData(parsePersonalDataImport(text, NOW), NOW)
    expect(summary.emotions).toEqual({ added: 0, duplicate: 1, invalid: 0 })
    expect(summary.sessions).toEqual({ added: 0, duplicate: 1, invalid: 0 })
    expect(await db.emotions.count()).toBe(1)
    expect(await db.sessions.count()).toBe(1)
  })

  it('파일 안에서 같은 시각의 기록이 겹치면 하나만 넣는다', async () => {
    const e = { ...emotion('2026-10-27T09:01:00'), timestamp: '2026-10-27T00:01:00.000Z' }
    const summary = await importPersonalData(parsePersonalDataImport(file({ emotions: [e, e] }), NOW), NOW)
    expect(summary.emotions).toEqual({ added: 1, duplicate: 1, invalid: 0 })
  })
})

describe('합치기 정책', () => {
  it('이 기기의 설정은 덮어쓰지 않는다', async () => {
    saveSettings({ ...DEFAULT_SETTINGS, calibrationOffset: -3 })
    const text = file({
      localData: { [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, calibrationOffset: 9 }, onmaum_onboarded: true },
    })
    const summary = await importPersonalData(parsePersonalDataImport(text, NOW), NOW)
    expect(loadSettings().calibrationOffset).toBe(-3)
    expect(summary.localKeys).toEqual({ added: 1, kept: 1, ignored: 0 })
  })

  it('측정 중이던(active) 세션은 복구 종료로 바꿔 넣는다', async () => {
    const active = session('s2', '2026-10-20T09:00:00', {
      status: 'active',
      endedAt: null,
      endReason: null,
      lastSeenAt: new Date('2026-10-20T09:30:00'),
    })
    await importPersonalData(parsePersonalDataImport(file({ sessions: [active] }), NOW), NOW)
    const s = await db.sessions.get('s2')
    expect(s).toMatchObject({ status: 'interrupted', endReason: 'recovered' })
    expect(s?.endedAt?.getTime()).toBe(new Date('2026-10-20T09:30:00').getTime())
    expect(await db.sessions.where('status').equals('active').count()).toBe(0)
  })

  it('측정 중이면 가져오지 않는다', async () => {
    await db.emotions.add(emotion(new Date(NOW.getTime() - 30_000).toISOString()))
    const parsed = parsePersonalDataImport(file({ emotions: [emotion('2026-10-01T09:00:00')] }), NOW)
    await expect(importPersonalData(parsed, NOW)).rejects.toBeInstanceOf(MeasurementActiveError)
    expect(await db.emotions.count()).toBe(1)
  })
})

describe('파일 검사', () => {
  it.each<[string, string, string]>([
    ['JSON이 아님', 'not json', 'notJson'],
    ['객체가 아님', '[]', 'shape'],
    ['형식 버전이 다름', file({ schemaVersion: 1 }), 'version'],
    ['기록 배열이 없음', file({ emotions: null }), 'shape'],
    ['localData가 배열', file({ localData: [] }), 'shape'],
  ])('받을 수 없는 파일: %s', (_, text, reason) => {
    try {
      parsePersonalDataImport(text, NOW)
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(ImportFormatError)
      expect((err as ImportFormatError).reason).toBe(reason)
    }
  })

  it('너무 큰 파일은 읽기 전에 거부한다', () => {
    const big = ' '.repeat(MAX_IMPORT_BYTES + 1)
    expect(() => parsePersonalDataImport(big, NOW)).toThrow(ImportFormatError)
  })

  it('잘못된 기록은 건너뛰고 개수만 센다', () => {
    const good = emotion('2026-10-27T09:01:00')
    const bad = [
      { ...good, timestamp: 'yesterday' },
      { ...good, timestamp: '2019-12-31T00:00:00.000Z' }, // 너무 이른 시각
      { ...good, timestamp: '2026-11-30T00:00:00.000Z' }, // 미래
      { ...good, happy: 1.5 },
      { ...good, sad: Number.NaN },
      { ...good, duration: -1 },
      { ...good, duration: 2 * 60 * 60 * 1000 },
      { ...good, dominantEmotion: 'fearful' },
      { ...good, sessionId: 'x'.repeat(65) },
      null,
      'record',
    ]
    const parsed = parsePersonalDataImport(file({ emotions: [good, ...bad] }), NOW)
    expect(parsed.emotions).toHaveLength(1)
    expect(parsed.invalidEmotions).toBe(bad.length)
  })

  it('잘못된 세션은 건너뛴다', () => {
    const ok = session('s1', '2026-10-27T09:00:00')
    const parsed = parsePersonalDataImport(
      file({
        sessions: [
          ok,
          { ...ok, id: '' },
          { ...ok, status: 'paused' },
          { ...ok, endReason: 'crash' },
          { ...ok, startedAt: 'nope' },
          { ...ok, endedAt: 'nope' },
        ],
      }),
      NOW,
    )
    expect(parsed.sessions).toHaveLength(1)
    expect(parsed.invalidSessions).toBe(5)
  })

  it('허용한 localStorage 키만 가져온다', () => {
    const text = file({
      localData: {
        onmaum_profile: { reliefs: ['산책'] },
        'onmaum_nudge_2026-10-27': { count: 1, lastAtMs: 1 },
        onmaum_unknown: 1,
        'onmaum_checkin_2026-10-27x': {},
        other_app_key: 'x',
        onmaum_onboarded: 'x'.repeat(70 * 1024), // 값이 너무 큼
      },
    })
    // 객체 리터럴의 __proto__는 키가 되지 않으므로 JSON 문자열에 직접 넣는다
    const withProto = text.replace('"localData":{', '"localData":{"__proto__":{"polluted":true},')
    const parsed = parsePersonalDataImport(withProto, NOW)
    expect(parsed.localData.map(([k]) => k).sort()).toEqual(['onmaum_nudge_2026-10-27', 'onmaum_profile'])
    expect(parsed.ignoredLocalKeys).toBe(5)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
