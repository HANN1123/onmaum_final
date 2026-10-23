import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadCheckinDone,
  loadCheckinEntries,
  saveCheckinEntry,
  loadNudgeDayState,
  saveNudgeDayState,
} from '@/shared/storage/dayState'

describe('checkin dayState', () => {
  beforeEach(() => localStorage.clear())

  it('처음엔 완료 슬롯 없음', () => {
    expect(loadCheckinDone('2026-06-12')).toEqual([])
  })

  it('엔트리 저장 → 완료 슬롯에 반영, 날짜 분리', () => {
    saveCheckinEntry('2026-06-12', 'morning', 'agree', 1000)
    expect(loadCheckinDone('2026-06-12')).toEqual(['morning'])
    expect(loadCheckinDone('2026-06-13')).toEqual([])
    saveCheckinEntry('2026-06-12', 'afternoon', 'worse', 2000)
    expect(loadCheckinDone('2026-06-12').sort()).toEqual(['afternoon', 'morning'])
  })

  it('판정 근거(context)를 함께 저장하고 읽는다. 근거 없이 저장한 이전 형식도 그대로 읽힌다', () => {
    const context = { level: 'high' as const, recentStress: 42, adjusted: 45, mode: 'relative' as const, baselineN: 30, offsetBefore: 3 }
    saveCheckinEntry('2026-06-12', 'morning', 'worse', 1000, context)
    saveCheckinEntry('2026-06-12', 'afternoon', 'agree', 2000)
    const entries = loadCheckinEntries('2026-06-12')
    expect(entries.find((e) => e.slot === 'morning')?.context).toEqual(context)
    expect(entries.find((e) => e.slot === 'afternoon')?.context).toBeUndefined()
  })
})

describe('nudge dayState', () => {
  beforeEach(() => localStorage.clear())

  it('처음엔 count 0, lastAt null', () => {
    expect(loadNudgeDayState('2026-06-12')).toEqual({ count: 0, lastAtMs: null })
  })

  it('저장 후 로드, 날짜 분리', () => {
    saveNudgeDayState('2026-06-12', { count: 1, lastAtMs: 5000 })
    expect(loadNudgeDayState('2026-06-12')).toEqual({ count: 1, lastAtMs: 5000 })
    expect(loadNudgeDayState('2026-06-13')).toEqual({ count: 0, lastAtMs: null })
  })
})

describe('dayState 손상 데이터 방어', () => {
  beforeEach(() => localStorage.clear())

  it('checkin 값이 배열이 아니면 [] 반환', () => {
    localStorage.setItem('onmaum_checkin_2026-06-12', JSON.stringify({ not: 'an array' }))
    expect(loadCheckinDone('2026-06-12')).toEqual([])
  })

  it('checkin 깨진 JSON → []', () => {
    localStorage.setItem('onmaum_checkin_2026-06-12', '{broken')
    expect(loadCheckinDone('2026-06-12')).toEqual([])
  })

  it('체크인 항목의 슬롯·응답·시각이 맞지 않으면 건너뛰고, context만 깨졌으면 응답은 남긴다', () => {
    const good = { slot: 'morning', report: 'worse', atMs: 1000 }
    localStorage.setItem(
      'onmaum_checkin_2026-06-12',
      JSON.stringify([
        good,
        { slot: 'evening', report: 'agree', atMs: 1 }, // 없는 슬롯
        { slot: 'afternoon', report: 'maybe', atMs: 1 }, // 없는 응답
        { slot: 'afternoon', report: 'agree' }, // 시각 없음
        { slot: 'afternoon', report: 'agree', atMs: 2000, context: 'broken' }, // context만 손상
        { slot: 'afternoon', report: 'agree', atMs: 3000, context: { level: 'high', mode: 'relative', recentStress: 'x' } },
      ]),
    )
    const entries = loadCheckinEntries('2026-06-12')
    expect(entries).toEqual([
      good,
      { slot: 'afternoon', report: 'agree', atMs: 2000 },
      { slot: 'afternoon', report: 'agree', atMs: 3000 },
    ])
  })

  it('nudge 부분/손상 객체 → 기본값으로 보정', () => {
    localStorage.setItem('onmaum_nudge_2026-06-12', JSON.stringify({ count: 'x' }))
    expect(loadNudgeDayState('2026-06-12')).toEqual({ count: 0, lastAtMs: null })
  })
})
