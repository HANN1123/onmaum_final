import { describe, it, expect, afterEach } from 'vitest'
import { isDocumentPipSupported } from '@/lib/orb/pip'

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).documentPictureInPicture
})

describe('isDocumentPipSupported', () => {
  it('documentPictureInPicture 없으면 false', () => {
    expect(isDocumentPipSupported()).toBe(false)
  })
  it('있으면 true', () => {
    ;(window as unknown as Record<string, unknown>).documentPictureInPicture = {}
    expect(isDocumentPipSupported()).toBe(true)
  })
})
