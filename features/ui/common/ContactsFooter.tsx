export default function ContactsFooter() {
  return (
    <footer className="mt-8 border-t border-ink-200 pb-2 pt-4 text-center text-xs text-ink-500">
      <p>
        도움이 필요하면:{' '}
        <a
          href="tel:1577-0199"
          className="font-medium text-ink-700 hover:text-risk-good"
        >
          📞 1577-0199
        </a>
        {' · '}
        <a
          href="tel:1393"
          className="font-medium text-ink-700 hover:text-risk-good"
        >
          📞 1393
        </a>
      </p>
    </footer>
  )
}
