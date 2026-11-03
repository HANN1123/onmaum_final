import { jetbrainsMono, sora } from './fonts'
import styles from './HeroAbout.module.css'

/**
 * 히어로 바로 아래의 소개. 메뉴의 "소개"가 이 자리(#about)로 내려온다.
 * 세 덩어리만 둔다: 어떻게 재나요, 무엇이 어디에 남나요, 무엇이 아닌가요.
 * 예전 랜딩의 기능 카드·숫자 통계는 옮기지 않았다(같은 말을 여러 번 하던 부분).
 */

const BLOCKS = [
  {
    no: '01',
    title: '통화하는 동안 저절로 잽니다',
    body: '웹캠 하나로 표정에서 감정을, 얼굴의 미세한 색 변화에서 심박을 추정합니다. 따로 누를 것도, 몸에 붙일 것도 없습니다.',
  },
  {
    no: '02',
    title: '이 기기 안에만 남습니다',
    body: '영상은 저장하지 않습니다. 감정 비율과 심박만 기록되고 서버로 보내지 않습니다. 언제든 파일로 내보내거나 한 번에 지울 수 있습니다.',
  },
  {
    no: '03',
    title: '진단이 아니라 평소와의 비교입니다',
    body: '온마음은 의료기기가 아닙니다. 지난 14일의 나와 비교해 오늘이 가벼운지 무거운지만 알려 줍니다. 많이 힘들면 1577-0199, 109로 바로 연결하세요.',
  },
] as const

export default function HeroAbout({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <section id="about" className={`${sora.variable} ${jetbrainsMono.variable} ${styles.about}`} data-theme={theme} aria-label="온마음 소개">
      <div className={styles.grid}>
        {BLOCKS.map((b) => (
          <article key={b.no} className={styles.block}>
            <span className={styles.no}>{b.no}</span>
            <h2 className={styles.title}>{b.title}</h2>
            <p className={styles.body}>{b.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
