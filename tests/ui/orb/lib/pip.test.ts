import { describe, it, expect, afterEach } from 'vitest'
import { isDocumentPipSupported } from '@/features/ui/orb/lib/pip'

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
