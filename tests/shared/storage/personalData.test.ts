import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, type EmotionRecord, type MeasurementSession } from '@/shared/storage/db'
import {
  weekRange,
  dayRange,
  getPersonalRecordsByRange,
  exportPersonalData,
  serializeExport,
  deleteAllPersonalData,
  isMeasurementActive,
  MeasurementActiveError,
  PartialDeleteError,
  EXPORT_SCHEMA_VERSION,
} from '@/shared/storage/personalData'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '@/shared/storage/settings'

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

function session(id: string, startedAt: string): MeasurementSession {
  const t = new Date(startedAt)
  return { id, startedAt: t, endedAt: null, status: 'active', endReason: null, lastSeenAt: t }
}

beforeEach(async () => {
  await db.emotions.clear()
  await db.sessions.clear()
  localStorage.clear()
})

describe('dayRange / weekRange', () => {
  it('하루 범위는 로컬 자정부터 23:59:59.999까지', () => {
    const r = dayRange(new Date('2026-10-21T15:30:00'))
    expect(r.start).toEqual(new Date('2026-10-21T00:00:00'))
    expect(r.end).toEqual(new Date('2026-10-21T23:59:59.999'))
  })

  it('주 범위는 월요일 시작, 일요일 끝', () => {
    // 2026-10-21은 수요일
    const r = weekRange(new Date('2026-10-21T15:30:00'))
    expect(r.start).toEqual(new Date('2026-10-19T00:00:00'))
    expect(r.end).toEqual(new Date('2026-10-25T23:59:59.999'))
  })

  it('일요일은 그 주의 마지막 날로 계산한다', () => {
    const r = weekRange(new Date('2026-10-25T09:00:00'))
    expect(r.start).toEqual(new Date('2026-10-19T00:00:00'))
  })
})

describe('getPersonalRecordsByRange', () => {
  it('기간 안의 감정 기록과 세션을 시간순으로 돌려준다', async () => {
    await db.emotions.bulkAdd([
      emotion('2026-10-21T10:02:00', 's1'),
      emotion('2026-10-21T10:01:00', 's1'),
      emotion('2026-10-18T10:00:00'),
    ])
    await db.sessions.bulkAdd([session('s1', '2026-10-21T10:00:00'), session('s0', '2026-10-18T09:59:00')])

    const { start, end } = weekRange(new Date('2026-10-21T12:00:00'))
    const r = await getPersonalRecordsByRange(start, end)

    expect(r.emotions.map((e) => e.timestamp)).toEqual([
      new Date('2026-10-21T10:01:00'),
      new Date('2026-10-21T10:02:00'),
    ])
    expect(r.sessions.map((s) => s.id)).toEqual(['s1'])
  })
})

describe('exportPersonalData', () => {
  it('모든 감정 기록·세션과 onmaum_ 로컬 데이터를 담는다', async () => {
    await db.emotions.bulkAdd([emotion('2026-10-21T10:01:00', 's1'), emotion('2026-10-01T10:00:00')])
    await db.sessions.add(session('s1', '2026-10-21T10:00:00'))
    localStorage.setItem('onmaum_profile', JSON.stringify({ reliefs: ['산책'] }))
    localStorage.setItem('onmaum_onboarded', 'true')
    localStorage.setItem('other_app_key', 'x')

    const data = await exportPersonalData(new Date('2026-10-21T12:00:00'))

    expect(data.schemaVersion).toBe(EXPORT_SCHEMA_VERSION)
    expect(data.exportedAt).toBe(new Date('2026-10-21T12:00:00').toISOString())
    expect(data.emotions).toHaveLength(2)
    expect(data.sessions.map((s) => s.id)).toEqual(['s1'])
    expect(data.localData).toEqual({ onmaum_profile: { reliefs: ['산책'] }, onmaum_onboarded: true })
  })

  it('JSON으로 바꿨다가 다시 읽어도 날짜가 ISO 문자열로 남는다', async () => {
    await db.emotions.add(emotion('2026-10-21T10:01:00'))
    const json = serializeExport(await exportPersonalData(new Date('2026-10-21T12:00:00')))
    const parsed = JSON.parse(json)
    expect(parsed.emotions[0].timestamp).toBe(new Date('2026-10-21T10:01:00').toISOString())
  })

  it('JSON으로 읽을 수 없는 로컬 값은 문자열 그대로 담는다', async () => {
    localStorage.setItem('onmaum_broken', '{not json')
    const data = await exportPersonalData()
    expect(data.localData.onmaum_broken).toBe('{not json')
  })
})

describe('deleteAllPersonalData', () => {
  const LATER = new Date('2026-10-22T09:00:00')

  beforeEach(async () => {
    await db.emotions.add(emotion('2026-10-21T10:01:00', 's1'))
    await db.sessions.add(session('s1', '2026-10-21T10:00:00'))
    localStorage.setItem('onmaum_checkin_2026-10-21', '[]')
    localStorage.setItem('onmaum_nudge_2026-10-21', '{"count":1,"lastAtMs":1}')
    saveSettings({ ...DEFAULT_SETTINGS, calibrationOffset: 9, nudge: { ...DEFAULT_SETTINGS.nudge, enabled: true } })
    localStorage.setItem('onmaum_profile', JSON.stringify({ reliefs: ['산책'] }))
    localStorage.setItem('onmaum_onboarded', 'true')
    localStorage.setItem('onmaum_camera_rotation', '90')
    localStorage.setItem('other_app_key', 'x')
  })

  it('기본: 측정 기록·체크인·넛지 기록을 지우고, 설정·설문은 남기되 보정값은 0으로 되돌린다', async () => {
    await deleteAllPersonalData({}, LATER)

    expect(await db.emotions.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
    expect(localStorage.getItem('onmaum_checkin_2026-10-21')).toBeNull()
    expect(localStorage.getItem('onmaum_nudge_2026-10-21')).toBeNull()
    expect(loadSettings().calibrationOffset).toBe(0)
    expect(loadSettings().nudge.enabled).toBe(true)
    expect(localStorage.getItem('onmaum_profile')).not.toBeNull()
    expect(localStorage.getItem('onmaum_onboarded')).toBe('true')
    expect(localStorage.getItem('onmaum_camera_rotation')).toBe('90')
    expect(localStorage.getItem('other_app_key')).toBe('x')
  })

  it('includePreferences: 설정·설문·온보딩 여부까지 모두 지운다', async () => {
    await deleteAllPersonalData({ includePreferences: true }, LATER)

    expect(await db.emotions.count()).toBe(0)
    expect(Object.keys(localStorage).filter((k) => k.startsWith('onmaum_'))).toEqual([])
    expect(localStorage.getItem('other_app_key')).toBe('x')
  })

  it('기기 저장소 일부를 지우지 못하면 PartialDeleteError로 알린다', async () => {
    const original = localStorage.removeItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
      if (key.startsWith('onmaum_checkin_')) throw new Error('quota')
      original(key)
    })
    try {
      await expect(deleteAllPersonalData({}, LATER)).rejects.toBeInstanceOf(PartialDeleteError)
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('deleteAllPersonalData 저장소 접근 실패', () => {
  it('키 목록을 읽지 못하면 성공으로 끝내지 않는다', async () => {
    localStorage.setItem('onmaum_profile', '{"reliefs":[]}')
    const spy = vi.spyOn(localStorage, 'key').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    try {
      await expect(
        deleteAllPersonalData({ includePreferences: true }, new Date('2026-10-22T09:00:00')),
      ).rejects.toBeInstanceOf(PartialDeleteError)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('측정 중 삭제 방지', () => {
  const NOW = new Date('2026-10-21T12:00:00')

  it('최근 2분 안에 감정 기록이 저장됐으면 지우지 않는다', async () => {
    await db.emotions.add(emotion('2026-10-21T11:59:00'))
    await expect(deleteAllPersonalData({}, NOW)).rejects.toBeInstanceOf(MeasurementActiveError)
    expect(await db.emotions.count()).toBe(1)
  })

  it('최근 갱신된 active 세션이 있으면 지우지 않는다', async () => {
    await db.sessions.add({ ...session('s1', '2026-10-21T11:00:00'), lastSeenAt: new Date('2026-10-21T11:59:30') })
    expect(await isMeasurementActive(NOW)).toBe(true)
    await expect(deleteAllPersonalData({}, NOW)).rejects.toBeInstanceOf(MeasurementActiveError)
  })

  it('오래된 기록과 끊긴 세션만 있으면 측정 중이 아니다', async () => {
    await db.emotions.add(emotion('2026-10-21T11:50:00'))
    await db.sessions.add({ ...session('s1', '2026-10-21T11:00:00'), lastSeenAt: new Date('2026-10-21T11:50:00') })
    expect(await isMeasurementActive(NOW)).toBe(false)
    await deleteAllPersonalData({}, NOW)
    expect(await db.emotions.count()).toBe(0)
  })
})
