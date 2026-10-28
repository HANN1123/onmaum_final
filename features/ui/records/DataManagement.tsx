'use client'

import { useEffect, useRef, useState } from 'react'
import {
  deleteAllPersonalData,
  exportPersonalData,
  serializeExport,
  MeasurementActiveError,
} from '@/shared/storage/personalData'
import {
  importPersonalData,
  parsePersonalDataImport,
  ImportFormatError,
  MAX_IMPORT_BYTES,
  type ImportSummary,
} from '@/shared/storage/personalImport'

type Status = { kind: 'idle' } | { kind: 'done'; text: string } | { kind: 'error'; text: string }

function downloadJson(json: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  // 일부 브라우저는 클릭 직후 해제하면 다운로드를 시작하지 못하므로 잠시 뒤에 해제한다
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function importResultText(s: ImportSummary): string {
  const parts = [`기록 ${s.emotions.added}개를 가져왔어요`]
  if (s.emotions.duplicate > 0) parts.push(`이미 있던 ${s.emotions.duplicate}개는 건너뛰었어요`)
  const invalid = s.emotions.invalid + s.sessions.invalid
  if (invalid > 0) parts.push(`읽을 수 없는 ${invalid}개는 빼고 가져왔어요`)
  if (s.localKeys.kept > 0) parts.push('이 기기의 설정은 그대로 두었어요')
  if (s.localKeys.failed > 0) {
    parts.push(`설정·체크인 기록 ${s.localKeys.failed}개는 저장하지 못했어요. 저장 공간을 확인한 뒤 다시 가져와 주세요`)
  }
  return parts.join('. ')
}

function importErrorText(err: unknown): string {
  if (err instanceof MeasurementActiveError) {
    return '측정이 진행 중이에요. 측정을 멈추고 2분 뒤에 다시 시도해 주세요'
  }
  if (err instanceof ImportFormatError) {
    if (err.reason === 'tooLarge' || err.reason === 'tooMany') return '파일이 너무 커서 가져올 수 없어요'
    if (err.reason === 'version') return '이 버전의 온마음에서 내보낸 파일이 아니라 가져올 수 없어요'
    return '온마음에서 내보낸 기록 파일(JSON)이 아니에요'
  }
  return '기록을 가져오지 못했어요. 잠시 후 다시 시도해 주세요'
}

export default function DataManagement() {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [includePreferences, setIncludePreferences] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 확인 단계를 열면 안전한 "취소"로, 닫으면 원래 "지우기" 버튼으로 포커스를 옮긴다
  useEffect(() => {
    if (confirming) cancelButtonRef.current?.focus()
    else if (wasConfirming.current) deleteButtonRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  const handleExport = async () => {
    setBusy(true)
    try {
      const data = await exportPersonalData()
      const date = new Date().toLocaleDateString('en-CA')
      downloadJson(serializeExport(data), `onmaum-records-${date}.json`)
      setStatus({
        kind: 'done',
        text: `기록 ${data.emotions.length}개로 파일 다운로드를 시작했어요. 다운로드 폴더에서 확인해 주세요`,
      })
    } catch {
      setStatus({ kind: 'error', text: '파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요' })
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new ImportFormatError('tooLarge')
      const summary = await importPersonalData(parsePersonalDataImport(await file.text()))
      setStatus({ kind: 'done', text: importResultText(summary) })
    } catch (err) {
      setStatus({ kind: 'error', text: importErrorText(err) })
    } finally {
      setBusy(false)
      // 같은 파일을 다시 골라도 change가 일어나도록 비운다
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await deleteAllPersonalData({ includePreferences })
      setConfirming(false)
      setIncludePreferences(false)
      setStatus({ kind: 'done', text: '모든 기록을 지웠어요' })
    } catch (err) {
      setStatus({
        kind: 'error',
        text:
          err instanceof MeasurementActiveError
            ? '측정이 진행 중이에요. 다른 탭이나 창의 측정을 멈추고 2분 뒤에 다시 시도해 주세요'
            : '일부 기록을 지우지 못했어요. 앱을 새로 고친 뒤 다시 시도해 주세요',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium text-ink-900">내 기록 관리</p>
        <p className="mt-1 text-xs text-ink-500">
          기록은 이 기기에만 있어요. 파일로 내보내 다른 기기(데스크톱 앱 등)로 가져오거나 한 번에 지울 수 있어요
        </p>
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

        <button
          type="button"
          onClick={() => {
            setStatus({ kind: 'idle' })
            fileInputRef.current?.click()
          }}
          disabled={busy}
          className="w-full rounded-xl border border-ink-300 py-2.5 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50"
        >
          기록 파일 가져오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="가져올 기록 파일"
          onChange={(e) => void handleImport(e.target.files?.[0])}
        />

        {!confirming ? (
          <button
            ref={deleteButtonRef}
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
                ref={cancelButtonRef}
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
