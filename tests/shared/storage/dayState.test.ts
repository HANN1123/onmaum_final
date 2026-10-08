import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadCheckinDone,
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

  it('nudge 부분/손상 객체 → 기본값으로 보정', () => {
    localStorage.setItem('onmaum_nudge_2026-06-12', JSON.stringify({ count: 'x' }))
    expect(loadNudgeDayState('2026-06-12')).toEqual({ count: 0, lastAtMs: null })
  })
})
