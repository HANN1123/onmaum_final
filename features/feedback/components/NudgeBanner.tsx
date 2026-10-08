'use client'

interface Props {
  open: boolean
  message: string
  onClose: () => void
  onMute: () => void
}

export default function NudgeBanner({ open, message, onClose, onMute }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto w-full max-w-md space-y-3 rounded-2xl border border-risk-good/30 bg-white p-4 shadow-lg">
        <p className="text-sm text-ink-800">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-risk-good px-4 py-2 text-sm font-medium text-white"
          >
            좋아요
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={onMute}
            className="rounded-full px-3 py-2 text-xs text-ink-400 hover:text-ink-600"
          >
            오늘은 그만
          </button>
        </div>
      </div>
    </div>
  )
}
