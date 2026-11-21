'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from 'react'
import { MENU_ICON, themeMenuItem } from '@/features/ui/measure/demo/menuItems'
import NavMenu, { type NavMenuItem } from '@/features/ui/measure/demo/NavMenu'
import { needsSurvey } from '@/shared/storage/onboarding'
import styles from './HeroDark.module.css'
import { DEMO_FALLBACK_POSTER_DARK, DEMO_FALLBACK_VIDEO_DARK } from './demoAssets'
import { readDemoName, saveDemoName } from './demoName'
import HeroAbout from './HeroAbout'
import HeroStage from './HeroStage'
import { DEMO_HOME_HREF } from './routes'
import { nextTypedChars, type TypedChar } from './typedChars'
import { jetbrainsMono, sora } from './fonts'
import { useDemoTheme } from './useDemoTheme'
import { useWebcam } from './useWebcam'

/**
 * 검정 배경 전체 화면 히어로 데모.
 * 왼쪽·가운데는 영상(기본은 전면 웹캠, 거절하면 참고 시안의 영상), 오른쪽은 측정 입장 패널.
 * 라틴 표시 글자는 Sora·JetBrains Mono, 한글은 전역 Pretendard 로 떨어진다.
 * media="stage" 이면 웹캠 대신 왼쪽에 반복 재생되는 제품 장면(HeroStage)을 둔다. 웹캠은 켜지 않는다.
 * 위쪽 오른쪽은 측정 화면과 같은 메뉴 버튼 하나다(2026-11-21). 설문 입력·수정과 화면 색 바꾸기를 넣고,
 * 위쪽 "측정 시작" 버튼은 본문 버튼과 겹쳐 뺐다. 좁은 창에서는 글자 링크가 숨으므로 링크도 메뉴에 넣는다.
 */

/** 측정 시작이 여는 화면. 데모가 실제 /measure 로 옮겨지면 되돌린다. */
const MEASURE_HREF = '/demo/measure'
/** 처음 설문(개인화). "측정 시작"은 설문을 아직 안 했으면 여기로 먼저 간다. */
const SURVEY_HREF = '/demo/survey'

const NAV_LINKS = [
  { href: MEASURE_HREF, label: '측정', icon: 'measure' },
  { href: '/demo/report', label: '리포트', icon: 'result' },
  { href: '/demo/records', label: '기록', icon: 'records' },
  { href: '#about', label: '소개', icon: 'about' },
] as const

const DESKTOP_MENU_QUERY = '(min-width: 901px)'
/** 설문 입력·수정. 저장된 답을 미리 골라 두고, 마치면 시작 화면으로 돌아온다 */
const SURVEY_EDIT_HREF = '/demo/survey?edit=home'

/** 위쪽 글자 링크가 보이는 넓은 창인지. 서버와 첫 렌더에서는 넓은 창으로 본다 */
function subscribeWide(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_MENU_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(DESKTOP_MENU_QUERY).matches, () => true)
}
/** 이름 칸의 이름표. 한 글자씩 떠오르므로 짧게 둔다. */
const NAME_LABEL = '이름'

export default function HeroDark({ media = 'webcam' }: { media?: 'webcam' | 'stage' }) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const webcam = useWebcam(videoRef, media === 'webcam')
  const [theme, toggleTheme] = useDemoTheme()
  // 이름 칸에 겹쳐 그리는 글자. 처음 입력하기 전(null)에는 입력 칸 글자를 그대로 보여준다.
  // 그래야 브라우저가 이전 값을 되살려 둔 경우에도 글자가 사라지지 않는다.
  const [typed, setTyped] = useState<TypedChar[] | null>(null)
  const typedIdRef = useRef(0)
  const typedLineRef = useRef<HTMLSpanElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const wide = useWide()
  const menuItems: NavMenuItem[] = [
    ...(wide ? [] : NAV_LINKS.map((link) => ({ key: link.href, label: link.label, icon: MENU_ICON[link.icon], href: link.href }))),
    { key: 'survey', label: '설문 입력·수정', hint: '처음 설문 답 고치기', icon: MENU_ICON.survey, href: SURVEY_EDIT_HREF },
    themeMenuItem(theme, toggleTheme),
  ]

  // 이 기기에 저장해 둔 이름을 되살린다. 서버 첫 화면과 어긋나지 않게 하이드레이션 뒤에 채우고, 떠오르는 효과 없이 보여준다.
  useEffect(() => {
    const saved = readDemoName()
    const input = nameRef.current
    if (!saved || !input) return
    input.value = saved
    const { chars, nextId } = nextTypedChars([], saved, 0)
    typedIdRef.current = nextId
    setTyped(chars.map((c) => ({ ...c, still: true })))
  }, [])

  /** 겹친 글자를 입력 칸의 가로 스크롤에 맞춘다. 이름이 칸보다 길어질 때만 움직인다. */
  const syncTypedScroll = (input: HTMLInputElement) => {
    requestAnimationFrame(() => {
      if (typedLineRef.current) typedLineRef.current.style.transform = `translateX(${-input.scrollLeft}px)`
    })
  }

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const { chars, nextId } = nextTypedChars(typed ?? [], input.value, typedIdRef.current)
    typedIdRef.current = nextId
    setTyped(chars)
    syncTypedScroll(input)
    saveDemoName(input.value)
  }

  // 측정 시작(본문 버튼): 처음이거나 새 설문(저장·알림 선택)을 거친 적이 없으면 설문을 거쳐 측정으로,
  // 설문을 이미 마쳤으면 바로 측정으로 간다. 설문을 건너뛰는 길은 "설문 없이 바로 측정"뿐이다.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    router.push(needsSurvey() ? SURVEY_HREF : MEASURE_HREF)
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
            <NavMenu items={menuItems} />
          </div>
        </nav>

        <div className={`${styles.body} ${media === 'stage' ? styles.bodyStage : ''}`}>
          {media === 'stage' && <HeroStage scheme={theme} />}
          <div className={styles.panel}>
            <span className={styles.chip}>[ 측정 준비 ]</span>
            <h1 className={styles.h1}>ONMAUM</h1>
            <p className={styles.tagline}>온마음 · 당신의 표정과 맥박을 읽는, 본인만 보는 기록.</p>

            <form className={styles.form} action="#" method="post" noValidate onSubmit={onSubmit}>
              {/*
                이름 칸: 누르면 이름표가 한 글자씩 시차를 두고 위로 떠오르고, 밑줄 가운데에서 선이 양옆으로 펼쳐진다
                (uiverse "afraid-yak-99" 발상을 흑백 토큰·선택 입력·접근성에 맞게 옮김).
                이름표와 "이 기기에만 저장"은 입력하는 동안에도 남는다. 쪼갠 글자는 화면 읽기에서 숨기고 온전한 이름표를 읽힌다.
                쓰는 글자는 입력 칸 위에 한 글자씩 겹쳐 그려, 새로 친 글자만 아래에서 떠오르게 한다(입력 칸 글자는 투명, 커서는 그대로).
                한글을 조합하는 동안(ㄱ→기→김)은 같은 자리 글자라 다시 떠오르지 않는다.
              */}
              <div className={styles.field}>
                <input
                  ref={nameRef}
                  id="hero-name"
                  name="name"
                  type="text"
                  autoComplete="nickname"
                  placeholder=" "
                  aria-describedby="hero-name-hint"
                  className={`${styles.fieldInput} ${typed ? styles.fieldInputTyped : ''}`}
                  onChange={onNameChange}
                  onSelect={(event) => syncTypedScroll(event.currentTarget)}
                />
                {typed && (
                  <span className={styles.fieldTyped} aria-hidden="true">
                    <span ref={typedLineRef} className={styles.fieldTypedLine}>
                      {typed.map((c) => (
                        <span
                          key={c.id}
                          className={styles.fieldTypedChar}
                          data-still={c.still ? '' : undefined}
                          style={{ '--k': c.k } as React.CSSProperties}
                        >
                          {c.ch}
                        </span>
                      ))}
                    </span>
                  </span>
                )}
                <span className={styles.fieldBar} aria-hidden="true" />
                <label htmlFor="hero-name" className={styles.fieldLabel}>
                  <span className={styles.srOnly}>{NAME_LABEL}</span>
                  <span className={styles.fieldChars} aria-hidden="true">
                    {Array.from(NAME_LABEL).map((ch, i) => (
                      <span key={i} className={styles.fieldChar} style={{ '--i': i } as React.CSSProperties}>
                        {ch}
                      </span>
                    ))}
                  </span>
                </label>
                <span id="hero-name-hint" className={styles.fieldHint}>
                  이 기기에만 저장
                </span>
              </div>
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
          측정을 시작하면 기록이 이 기기 안에만 남는 것에 동의하는 것입니다. 온마음은 의료기기가 아닙니다.
        </footer>
      </section>
      <HeroAbout theme={theme} />
    </>
  )
}
