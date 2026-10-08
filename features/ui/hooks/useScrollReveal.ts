'use client'

import { useEffect } from 'react'

/**
 * 페이지 내 모든 .r 요소를 IntersectionObserver로 감지해서
 * viewport에 진입하면 .in 클래스 추가 (CSS transition 트리거).
 *
 * globals.css의 .r / .r.in 정의와 한 쌍으로 동작.
 *
 * 안전망: 100ms 후 viewport 안에 있는 .r 요소는 강제로 .in 추가
 *  (IntersectionObserver가 어떤 이유로 첫 callback을 트리거하지 못해도 보이게)
 */
export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -5% 0px' },
    )

    const elements = document.querySelectorAll('.r')
    elements.forEach((el) => observer.observe(el))

    // 안전망: viewport 안 .r 요소는 100ms 후 강제 .in
    const safetyId = window.setTimeout(() => {
      document.querySelectorAll('.r:not(.in)').forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('in')
        }
      })
    }, 100)

    return () => {
      observer.disconnect()
      window.clearTimeout(safetyId)
    }
  }, [])
}
