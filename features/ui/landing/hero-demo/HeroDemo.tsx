'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import styles from './HeroDemo.module.css'
import { DEMO_FALLBACK_VIDEO_LIGHT } from './demoAssets'
import { useScrubVideo } from './useScrubVideo'
import { useTypewriter } from './useTypewriter'
import { useWebcam } from './useWebcam'

/**
 * 전체 화면 히어로 데모.
 * 배경은 기본적으로 전면 웹캠 영상이다. videoSrc 를 주거나 카메라를 거절하면 영상을 마우스 가로 이동으로 스크럽한다.
 * 글자색은 검정이므로 영상 위에 옅은 흰 막을 한 겹 깐다.
 */

const NAV_LINKS = [
  { href: '/measure', label: '측정' },
  { href: '/stats', label: '리포트' },
  { href: '/records', label: '기록' },
  { href: '/', label: '소개' },
] as const

const PILLS = [
  { href: '/measure', label: '측정 시작하기' },
  { href: '/stats', label: '오늘 리포트 보기' },
  { href: '/records', label: '내 기록 관리' },
  { href: '/#features', label: '어떻게 동작하나요' },
] as const

const HELP_NUMBER = '1577-0199'
const INTRO_LINE_1 = '안녕하세요, 온마음입니다.'
const INTRO_LINE_2 = '웹캠으로 표정과 맥박을 읽어 본인만 보는 기록을 남깁니다'
const TYPED_TEXT =
  '들러 주셔서 고맙습니다. 지금 카메라가 당신을 보고 있고, 읽은 것은 이 기기 안에만 남습니다. 오늘은 무엇부터 볼까요?'

const PILL_BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-[0.3em] text-[13px] transition-colors duration-200 sm:px-5 sm:text-[15px] mx-[0.2em] mb-[0.4em]'

interface Props {
  /** 미리 찍어 둔 영상 경로. 없으면 웹캠을 배경으로 쓴다. */
  videoSrc?: string
}

export default function HeroDemo({ videoSrc }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // 웹캠이 기본. 거절되면 참고 시안의 영상을 스크럽 모드로 보여 준다.
  const webcam = useWebcam(videoRef, !videoSrc)
  const effectiveSrc = videoSrc ?? (webcam === 'denied' ? DEMO_FALLBACK_VIDEO_LIGHT : undefined)
  useScrubVideo(videoRef, Boolean(effectiveSrc))
  const { displayed, done } = useTypewriter(TYPED_TEXT)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pillsVisible, setPillsVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  // 버튼은 타자 효과와 무관하게 400ms 뒤에 올라온다.
  useEffect(() => {
    const timer = setTimeout(() => setPillsVisible(true), 400)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copyHelpNumber = async () => {
    try {
      await navigator.clipboard.writeText(HELP_NUMBER)
      setCopied(true)
    } catch (err) {
      console.error('클립보드 복사 실패:', err)
    }
  }

  return (
    <div className={`${styles.root} min-h-screen text-black`}>
      {/* 배경 영상 — 웹캠이면 거울처럼 좌우 반전 */}
      <video
        ref={videoRef}
        src={effectiveSrc}
        muted
        playsInline
        preload="auto"
        className={`fixed inset-0 z-0 h-full w-full object-cover [object-position:70%_center] ${
          webcam === 'ready' ? '-scale-x-100 grayscale brightness-110' : ''
        }`}
      />
      {/* 검정 글자가 영상 위에서도 읽히도록 옅은 흰 막 한 겹 */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-white/35" />

      {/* 상단 내비게이션 */}
      <nav className="fixed inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className={`${styles.heading} text-[21px] tracking-tight sm:text-[26px]`}>온마음</span>
          <span aria-hidden="true" className="select-none text-[25px] tracking-[-0.02em] sm:text-[30px]">
            ✳︎
          </span>
        </Link>

        <div className="hidden gap-[0.35em] text-[23px] md:flex">
          {NAV_LINKS.map((link, i) => (
            <span key={link.href}>
              <Link href={link.href} className="transition-opacity hover:opacity-60">
                {link.label}
              </Link>
              {i < NAV_LINKS.length - 1 && ','}
            </span>
          ))}
        </div>

        <Link
          href="/measure"
          className="hidden text-[23px] underline underline-offset-2 transition-opacity hover:opacity-60 md:inline"
        >
          측정 시작
        </Link>

        <button
          type="button"
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex flex-col gap-[5px] md:hidden"
        >
          <span
            className={`block h-[2px] w-6 bg-black transition duration-300 ${
              menuOpen ? 'translate-y-[7px] rotate-45' : ''
            }`}
          />
          <span className={`block h-[2px] w-6 bg-black transition duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span
            className={`block h-[2px] w-6 bg-black transition duration-300 ${
              menuOpen ? '-translate-y-[7px] -rotate-45' : ''
            }`}
          />
        </button>
      </nav>

      {/* 모바일 메뉴 */}
      <div
        className="fixed inset-0 z-[9] flex flex-col items-start justify-center gap-8 bg-white/95 px-8 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        style={{ opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? 'auto' : 'none' }}
      >
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-[32px] font-medium" onClick={() => setMenuOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link
          href="/measure"
          className="text-[32px] font-medium underline underline-offset-2"
          onClick={() => setMenuOpen(false)}
        >
          측정 시작
        </Link>
      </div>

      {/* 히어로 */}
      <section className="relative z-[1] flex h-screen flex-col justify-end overflow-hidden px-5 pb-12 sm:px-8 md:justify-center md:px-10 md:pb-0">
        <div className="relative z-10 max-w-xl">
          <p
            aria-hidden="true"
            className="pointer-events-none mb-5 select-none sm:mb-6"
            style={{ fontSize: 'clamp(18px, 4vw, 26px)', lineHeight: 1.3, fontWeight: 400, filter: 'blur(4px)' }}
          >
            {INTRO_LINE_1}
            <br />
            {INTRO_LINE_2}
          </p>

          <p
            className="mb-5 sm:mb-6"
            style={{ fontSize: 'clamp(18px, 4vw, 26px)', lineHeight: 1.35, fontWeight: 400, minHeight: 54 }}
          >
            {displayed}
            {!done && (
              <span aria-hidden="true" className={`${styles.cursor} ml-[2px] inline-block h-[1.1em] w-[2px] bg-black align-middle`} />
            )}
          </p>

          <div
            className="flex flex-wrap gap-y-1"
            style={{
              opacity: pillsVisible ? 1 : 0,
              transform: pillsVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {PILLS.map((pill) => (
              <Link
                key={pill.href}
                href={pill.href}
                className={`${PILL_BASE} border border-black/10 bg-white text-black hover:bg-black hover:text-white`}
              >
                {pill.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={copyHelpNumber}
              className={`${PILL_BASE} gap-2 border border-black bg-transparent text-black hover:bg-black hover:text-white sm:gap-3`}
            >
              <span>
                도움이 필요하면: <span className="underline underline-offset-1">{HELP_NUMBER}</span>
              </span>
              {copied ? (
                <span className="text-[11px]">복사됨</span>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  aria-hidden="true"
                >
                  <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
                  <rect x="1.5" y="1.5" width="7" height="7" rx="1" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {webcam === 'denied' && (
          <p className="absolute bottom-4 right-5 z-10 text-[12px] text-black/60 sm:right-8">
            카메라를 허용하면 배경에 영상이 보입니다
          </p>
        )}
      </section>
    </div>
  )
}
