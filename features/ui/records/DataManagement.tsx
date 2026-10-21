'use client'

import { useState } from 'react'
import {
  deleteAllPersonalData,
  exportPersonalData,
  serializeExport,
} from '@/shared/storage/personalData'

type Status = { kind: 'idle' } | { kind: 'done'; text: string } | { kind: 'error'; text: string }

function downloadJson(json: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export default function DataManagement() {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [includePreferences, setIncludePreferences] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const handleExport = async () => {
    setBusy(true)
    try {
      const data = await exportPersonalData()
      const date = new Date().toLocaleDateString('en-CA')
      downloadJson(serializeExport(data), `onmaum-records-${date}.json`)
      setStatus({ kind: 'done', text: `기록 ${data.emotions.length}개를 파일로 저장했어요` })
    } catch {
      setStatus({ kind: 'error', text: '파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요' })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await deleteAllPersonalData({ includePreferences })
      setConfirming(false)
      setIncludePreferences(false)
      setStatus({ kind: 'done', text: '모든 기록을 지웠어요' })
    } catch {
      setStatus({ kind: 'error', text: '기록을 지우지 못했어요. 측정 중이라면 멈춘 뒤 다시 시도해 주세요' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-ink-900">내 기록 관리</p>
        <p className="mt-1 text-xs text-ink-500">기록은 이 기기에만 있어요. 파일로 옮기거나 한 번에 지울 수 있어요</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="w-full rounded-xl border border-ink-300 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
        >
          기록 파일로 내보내기 (JSON)
        </button>

        {!confirming ? (
          <button
            type="button"
            onClick={() => {
              setConfirming(true)
              setStatus({ kind: 'idle' })
            }}
            disabled={busy}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-risk-warning hover:bg-ink-50 disabled:opacity-50"
          >
            모든 기록 지우기
          </button>
        ) : (
          <div role="group" aria-label="기록 삭제 확인" className="space-y-3 rounded-xl bg-ink-50 p-3">
            <p className="text-sm text-ink-800">
              측정 기록, 체크인과 알림 기록을 모두 지워요. 지운 기록은 되돌릴 수 없어요. 필요하면 먼저 파일로 내보내 주세요
            </p>
            <label htmlFor="delete-include-preferences" className="flex items-center gap-2 text-xs text-ink-600">
              <input
                id="delete-include-preferences"
                type="checkbox"
                checked={includePreferences}
                onChange={(e) => setIncludePreferences(e.target.checked)}
              />
              알림 설정과 처음 설문 답변도 함께 지우기
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 rounded-lg border border-ink-300 py-2 text-sm text-ink-700 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 rounded-lg bg-risk-warning py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                지우기
              </button>
            </div>
          </div>
        )}
      </div>

      {status.kind !== 'idle' && (
        <p
          role="status"
          className={`text-xs ${status.kind === 'error' ? 'text-risk-warning' : 'text-ink-600'}`}
        >
          {status.text}
        </p>
      )}
    </div>
  )
}
