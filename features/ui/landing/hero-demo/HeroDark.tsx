'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import styles from './HeroDark.module.css'
import { DEMO_FALLBACK_POSTER_DARK, DEMO_FALLBACK_VIDEO_DARK } from './demoAssets'
import HeroAbout from './HeroAbout'
import HeroStage from './HeroStage'
import { DEMO_HOME_HREF } from './routes'
import { jetbrainsMono, sora } from './fonts'
import { useDemoTheme } from './useDemoTheme'
import { useWebcam } from './useWebcam'

/**
 * 검정 배경 전체 화면 히어로 데모.
 * 왼쪽·가운데는 영상(기본은 전면 웹캠, 거절하면 참고 시안의 영상), 오른쪽은 측정 입장 패널.
 * 라틴 표시 글자는 Sora·JetBrains Mono, 한글은 전역 Pretendard 로 떨어진다.
 * media="stage" 이면 웹캠 대신 왼쪽에 반복 재생되는 제품 장면(HeroStage)을 둔다. 웹캠은 켜지 않는다.
 */

/** 측정 시작이 여는 화면. 데모가 실제 /measure 로 옮겨지면 되돌린다. */
const MEASURE_HREF = '/demo/measure'

const NAV_LINKS = [
  { href: MEASURE_HREF, label: '측정' },
  { href: '/demo/report', label: '리포트' },
  { href: '/demo/records', label: '기록' },
  { href: '#about', label: '소개' },
] as const

const DESKTOP_MENU_QUERY = '(min-width: 901px)'

export default function HeroDark({ media = 'webcam' }: { media?: 'webcam' | 'stage' }) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null)
  const webcam = useWebcam(videoRef, media === 'webcam')
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, toggleTheme] = useDemoTheme()

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // 열림: 본문 스크롤 잠금 + 첫 링크로 포커스. 닫힘: 토글로 포커스 복귀. Escape 로 닫기.
  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen)
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    if (menuOpen) {
      firstMenuLinkRef.current?.focus()
    } else {
      toggleRef.current?.focus({ preventScroll: true })
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('menu-open')
      document.body.style.overflow = ''
    }
  }, [menuOpen, closeMenu])

  // 데스크톱 폭이 되면 자동으로 닫는다.
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MENU_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeMenu()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [closeMenu])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    router.push(MEASURE_HREF)
  }

  const useFallback = webcam === 'denied'

  return (
    <>
      <section className={`${sora.variable} ${jetbrainsMono.variable} ${styles.hero}`} data-theme={theme}>
        {media === 'webcam' && (
          <>
            <div className={styles.media} style={{ '--poster': `url(${DEMO_FALLBACK_POSTER_DARK})` } as React.CSSProperties}>
              <video
                ref={videoRef}
                src={useFallback ? DEMO_FALLBACK_VIDEO_DARK : undefined}
                poster={useFallback ? DEMO_FALLBACK_POSTER_DARK : undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                className={webcam === 'ready' ? styles.mirror : undefined}
              />
            </div>
            <div className={styles.scrim} aria-hidden="true" />
          </>
        )}

        <nav className={styles.nav}>
          <Link href={DEMO_HOME_HREF} className={styles.logo}>
            ONMAUM
          </Link>
          <div className={styles.cluster}>
            <div className={styles.links}>
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={`${styles.link} ${styles.focusable}`}>
                  {link.label}
                </Link>
              ))}
            </div>
            <button type="button" className={`${styles.themeBtn} ${styles.focusable}`} onClick={toggleTheme}>
              {theme === 'dark' ? '화이트' : '다크'}
            </button>
            <Link href={MEASURE_HREF} className={`${styles.cta} ${styles.focusable}`}>
              측정 시작
            </Link>
            <button
              ref={toggleRef}
              type="button"
              className={`${styles.toggle} ${styles.focusable} ${menuOpen ? styles.toggleOpen : ''}`}
              aria-expanded={menuOpen}
              aria-controls="mobileMenu"
              aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className={`${styles.bar} ${styles.bar1}`} />
              <span className={`${styles.bar} ${styles.bar2}`} />
              <span className={`${styles.bar} ${styles.bar3}`} />
            </button>
          </div>
        </nav>

        <div
          id="mobileMenu"
          role="dialog"
          aria-modal="true"
          aria-label="사이트 메뉴"
          aria-hidden={!menuOpen}
          inert={!menuOpen}
          className={`${styles.menu} ${menuOpen ? styles.menuOpen : ''}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeMenu()
          }}
        >
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              ref={i === 0 ? firstMenuLinkRef : undefined}
              href={link.href}
              className={`${styles.menuItem} ${styles.menuLink} ${styles.focusable}`}
              style={{ '--i': i } as React.CSSProperties}
              onClick={closeMenu}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={MEASURE_HREF}
            className={`${styles.menuItem} ${styles.menuCta} ${styles.focusable}`}
            style={{ '--i': NAV_LINKS.length } as React.CSSProperties}
            onClick={closeMenu}
          >
            측정 시작
          </Link>
        </div>

        <div className={`${styles.body} ${media === 'stage' ? styles.bodyStage : ''}`}>
          {media === 'stage' && <HeroStage scheme={theme} />}
          <div className={styles.panel}>
            <span className={styles.chip}>[ 측정 준비 ]</span>
            <h1 className={styles.h1}>ONMAUM</h1>
            <p className={styles.tagline}>온마음 · 통화 중인 당신의 표정과 맥박을 읽는, 본인만 보는 기록.</p>

            <form className={styles.form} action="#" method="post" noValidate onSubmit={onSubmit}>
              <label htmlFor="hero-nickname" className={styles.srOnly}>
                별명
              </label>
              <input
                id="hero-nickname"
                name="nickname"
                type="text"
                autoComplete="nickname"
                placeholder="별명 (이 기기에만 저장)"
                className={`${styles.input} ${styles.focusable}`}
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.focusable}`}
                onClick={() => router.push(MEASURE_HREF)}
              >
                설문 없이 바로 측정
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnSolid} ${styles.focusable}`}>
                측정 시작
              </button>
            </form>

            <Link href="/demo/records" className={`${styles.referral} ${styles.focusable}`}>
              이미 기록이 있어요
            </Link>
          </div>
        </div>

        <footer className={styles.legal}>
          측정을 시작하면 기록이 이 기기 안에만 남는 것에 동의하는 것입니다. 온마음은 의료기기가 아닙니다.{' '}
          <a href="#privacy-notice">개인정보 안내</a> · <a href="#service-contract">이용 안내</a>
        </footer>
      </section>
      <HeroAbout theme={theme} />
    </>
  )
}
