export default function LandingFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-200 px-[52px] py-10 text-[11px] font-light text-ink-400">
      <div className="flex items-center gap-2.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 20C12 20 4 15.5 4 9.5C4 6.9 6.2 5 9 5C10.6 5 12 6 12 6C12 6 13.4 5 15 5C17.8 5 20 6.9 20 9.5C20 15.5 12 20 12 20Z"
            fill="rgba(107,171,154,0.5)"
          />
        </svg>
        <span>온마음 © 2026</span>
      </div>
      <div>
        정신건강위기상담{' '}
        <a
          href="tel:1577-0199"
          className="text-ink-600 transition-colors hover:text-risk-good"
        >
          1577-0199
        </a>{' '}
        · 자살예방{' '}
        <a
          href="tel:1393"
          className="text-ink-600 transition-colors hover:text-risk-good"
        >
          1393
        </a>{' '}
        (24시간)
      </div>
    </footer>
  )
}
