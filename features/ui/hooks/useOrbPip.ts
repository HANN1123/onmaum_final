'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isDocumentPipSupported } from '@/features/ui/orb/lib/pip'

interface DocumentPip {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>
}

export interface OrbPipApi {
  supported: boolean
  isOpen: boolean
  container: HTMLElement | null
  open: (opts?: { width?: number; height?: number }) => Promise<void>
  close: () => void
}

/**
 * Document Picture-in-Picture로 별도 항상-위 창을 열고, 그 body를 portal 대상으로 노출한다.
 * 메인 앱을 최소화해도 이 창은 떠 있다. (spec §8)
 */
export function useOrbPip(): OrbPipApi {
  const [supported] = useState(() => isDocumentPipSupported())
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const pipWindowRef = useRef<Window | null>(null)

  const close = useCallback(() => {
    pipWindowRef.current?.close()
    pipWindowRef.current = null
    setContainer(null)
  }, [])

  const open = useCallback(async (opts?: { width?: number; height?: number }) => {
    if (!isDocumentPipSupported()) return
    const dpip = (window as unknown as { documentPictureInPicture: DocumentPip })
      .documentPictureInPicture
    const pipWindow = await dpip.requestWindow({
      width: opts?.width ?? 240,
      height: opts?.height ?? 300,
    })

    // 메인 문서의 스타일시트를 복사 (CSS 모듈 포함). cross-origin이면 link로 대체.
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const css = Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('')
        const style = pipWindow.document.createElement('style')
        style.textContent = css
        pipWindow.document.head.appendChild(style)
      } catch {
        if (sheet.href) {
          const link = pipWindow.document.createElement('link')
          link.rel = 'stylesheet'
          link.href = sheet.href
          pipWindow.document.head.appendChild(link)
        }
      }
    }

    const body = pipWindow.document.body
    body.style.margin = '0'
    body.style.minHeight = '100vh'
    body.style.display = 'flex'
    body.style.alignItems = 'center'
    body.style.justifyContent = 'center'
    // 앱과 같은 라이트 톤 — 어두운 배경에선 글래스 오브가 칙칙해 보여 라이트로 통일
    body.style.background = 'radial-gradient(circle at 50% 38%, #ffffff, #eef1ef 88%)'

    pipWindow.addEventListener('pagehide', () => {
      pipWindowRef.current = null
      setContainer(null)
    })

    pipWindowRef.current = pipWindow
    setContainer(body)
  }, [])

  useEffect(
    () => () => {
      pipWindowRef.current?.close()
    },
    [],
  )

  return { supported, isOpen: container !== null, container, open, close }
}
