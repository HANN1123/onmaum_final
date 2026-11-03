import { describe, it, expect, beforeEach } from 'vitest'
import { readDemoName, saveDemoName } from '@/features/ui/landing/hero-demo/demoName'

describe('데모 이름 저장', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('저장한 이름을 다시 읽는다', () => {
    saveDemoName('김우빈')
    expect(readDemoName()).toBe('김우빈')
  })

  it('저장한 적이 없으면 빈 글자다', () => {
    expect(readDemoName()).toBe('')
  })

  it('이름을 다 지우면 저장된 값도 지운다', () => {
    saveDemoName('김우빈')
    saveDemoName('')
    expect(readDemoName()).toBe('')
    expect(localStorage.length).toBe(0)
  })
})
