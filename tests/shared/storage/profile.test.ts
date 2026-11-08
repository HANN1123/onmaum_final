import { describe, it, expect, beforeEach } from 'vitest'
import { loadProfile, saveProfile, PROFILE_KEY } from '@/shared/storage/profile'

beforeEach(() => localStorage.clear())

describe('profile', () => {
  it('저장된 게 없으면 null', () => {
    expect(loadProfile()).toBeNull()
  })
  it('저장 → 로드 라운드트립', () => {
    saveProfile({ reliefs: ['커피', '산책'] })
    expect(loadProfile()).toEqual({ reliefs: ['커피', '산책'] })
  })
  it('깨진 데이터 → null', () => {
    localStorage.setItem(PROFILE_KEY, '{not json')
    expect(loadProfile()).toBeNull()
  })
  it('reliefs가 배열이 아니면 null', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ reliefs: '커피' }))
    expect(loadProfile()).toBeNull()
  })
})

describe('profile: 2026-11 설문 필드', () => {
  beforeEach(() => localStorage.clear())
  it('새 필드를 읽고, 잘못된 새 필드만 뺀다', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ reliefs: [], treats: ['coffee'], deskActions: ['stretch'], mindActions: 'photo', breakBudget: 'about1m', breathing: 'x', tone: 'plain' }))
    expect(loadProfile()).toEqual({ reliefs: [], treats: ['coffee'], deskActions: ['stretch'], breakBudget: 'about1m', tone: 'plain' })
  })
  it('reliefs 원소가 문자열이 아니면 null', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ reliefs: [1] }))
    expect(loadProfile()).toBeNull()
  })
})
