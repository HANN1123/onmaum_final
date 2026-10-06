import { describe, it, expect, beforeEach } from 'vitest'
import { loadProfile, saveProfile, PROFILE_KEY } from '@/lib/storage/profile'

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
