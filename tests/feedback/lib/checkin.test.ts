import { describe, it, expect } from 'vitest'
import { currentSlot, checkinDue } from '@/features/feedback/lib/checkin'

const morning = { startHour: 10, endHour: 12 }
const afternoon = { startHour: 15, endHour: 17 }

describe('currentSlot', () => {
  it('창 안/밖 판정 (start 포함, end 미포함)', () => {
    expect(currentSlot(new Date('2026-06-12T10:00:00'), morning, afternoon)).toBe('morning')
    expect(currentSlot(new Date('2026-06-12T11:59:00'), morning, afternoon)).toBe('morning')
    expect(currentSlot(new Date('2026-06-12T12:00:00'), morning, afternoon)).toBeNull()
    expect(currentSlot(new Date('2026-06-12T15:30:00'), morning, afternoon)).toBe('afternoon')
    expect(currentSlot(new Date('2026-06-12T09:00:00'), morning, afternoon)).toBeNull()
  })
})

describe('checkinDue', () => {
  const base = { now: new Date('2026-06-12T10:30:00'), morning, afternoon, doneSlots: [], hasTodayData: true }
  it('창 안 + 미완료 + 데이터 있음 → due', () => {
    expect(checkinDue(base)).toEqual({ due: true, slot: 'morning' })
  })
  it('이미 완료한 창 → due 아님', () => {
    expect(checkinDue({ ...base, doneSlots: ['morning'] })).toEqual({ due: false, slot: 'morning' })
  })
  it('오늘 데이터 없음 → due 아님', () => {
    expect(checkinDue({ ...base, hasTodayData: false })).toEqual({ due: false, slot: 'morning' })
  })
  it('창 밖 → due 아님', () => {
    expect(checkinDue({ ...base, now: new Date('2026-06-12T13:00:00') })).toEqual({ due: false, slot: null })
  })
})
