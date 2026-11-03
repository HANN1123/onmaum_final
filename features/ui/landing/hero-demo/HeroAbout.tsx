'use client'

import Link from 'next/link'
import { OrbScene, RecordsScene, ResultScene } from './AboutScenes'
import { jetbrainsMono, sora } from './fonts'
import styles from './HeroAbout.module.css'

/**
 * 히어로 바로 아래의 소개. 메뉴의 "소개"가 이 자리(#about)로 내려온다.
 * 한 줄에 하나씩, 제목과 한두 줄의 글 옆에 실제 화면 부품으로 만든 장면을 둔다(장면이 설명한다).
 * 마지막 줄은 의료기기가 아님과 상담 번호, 측정 시작.
 */

const MEASURE_HREF = '/demo/measure'

export default function HeroAbout({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <section id="about" className={`${sora.variable} ${jetbrainsMono.variable} ${styles.about}`} data-theme={theme} aria-label="온마음 소개">
      <article className={styles.feature}>
        <div className={styles.copy}>
          <span className={styles.no}>01</span>
          <h2 className={styles.title}>통화하는 동안 저절로 잽니다</h2>
          <p className={styles.body}>웹캠 하나로 표정에서 감정을, 얼굴의 미세한 색 변화에서 심박을 추정합니다. 누를 것도, 몸에 붙일 것도 없습니다.</p>
        </div>
        <OrbScene scheme={theme} />
      </article>

      <article className={`${styles.feature} ${styles.flip}`}>
        <div className={styles.copy}>
          <span className={styles.no}>02</span>
          <h2 className={styles.title}>끝나면 가장 힘든 순간을 짚어 줍니다</h2>
          <p className={styles.body}>통화 한 건을 심박 선 하나로 그리고, 가장 힘들었던 구간으로 다가가 그때의 심박과 감정을 읽어 줍니다. 차트를 훑으면 그 순간의 값이 보입니다.</p>
        </div>
        <ResultScene scheme={theme} />
      </article>

      <article className={styles.feature}>
        <div className={styles.copy}>
          <span className={styles.no}>03</span>
          <h2 className={styles.title}>이 기기 안에만 남습니다</h2>
          <p className={styles.body}>영상은 저장하지 않습니다. 감정 비율과 심박만 기록되고 서버로 보내지 않습니다. 언제든 파일로 내보내거나 한 번에 지울 수 있습니다.</p>
        </div>
        <RecordsScene />
      </article>

      <div className={styles.closing}>
        <p>
          온마음은 의료기기가 아닙니다. 진단 대신 지난 14일의 나와 비교해 보여줍니다.
          <br />
          <span className={styles.dim}>많이 힘들면 정신건강 상담 1577-0199 · 자살예방 상담 109</span>
        </p>
        <Link href={MEASURE_HREF} className={styles.cta}>
          측정 시작
        </Link>
      </div>
    </section>
  )
}
