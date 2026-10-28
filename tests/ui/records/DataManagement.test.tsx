import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const deleteAllPersonalData = vi.fn(async () => {})
const exportPersonalData = vi.fn(async () => ({
  schemaVersion: 2,
  exportedAt: '2026-10-21T03:00:00.000Z',
  emotions: [{}, {}, {}],
  sessions: [],
  localData: {},
}))

vi.mock('@/shared/storage/personalData', () => ({
  deleteAllPersonalData: (...args: unknown[]) => deleteAllPersonalData(...(args as [])),
  exportPersonalData: () => exportPersonalData(),
  serializeExport: (d: unknown) => JSON.stringify(d),
  MeasurementActiveError: class MeasurementActiveError extends Error {},
}))

const importSummary = {
  emotions: { added: 5, duplicate: 2, invalid: 1 },
  sessions: { added: 1, duplicate: 0, invalid: 0 },
  localKeys: { added: 0, kept: 1, ignored: 0 },
}
const parsePersonalDataImport = vi.fn((text: string) => ({ text }))
const importPersonalData = vi.fn(async (_parsed: unknown) => importSummary)

vi.mock('@/shared/storage/personalImport', () => ({
  parsePersonalDataImport: (text: string) => parsePersonalDataImport(text),
  importPersonalData: (parsed: unknown) => importPersonalData(parsed),
  ImportFormatError: class ImportFormatError extends Error {
    constructor(readonly reason: string) {
      super(reason)
    }
  },
  MAX_IMPORT_BYTES: 1000,
}))

import DataManagement from '@/features/ui/records/DataManagement'
import { ImportFormatError } from '@/shared/storage/personalImport'
import { MeasurementActiveError } from '@/shared/storage/personalData'

beforeEach(() => {
  deleteAllPersonalData.mockClear()
  exportPersonalData.mockClear()
  parsePersonalDataImport.mockClear()
  importPersonalData.mockClear()
})

function chooseFile(content: string, name = 'onmaum-records.json') {
  const input = screen.getByLabelText('가져올 기록 파일') as HTMLInputElement
  const f = new File([content], name, { type: 'application/json' })
  fireEvent.change(input, { target: { files: [f] } })
}

describe('DataManagement', () => {
  it('지우기 버튼은 확인 단계를 거친 뒤에만 삭제한다', async () => {
    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '모든 기록 지우기' }))
    expect(screen.getByRole('group', { name: '기록 삭제 확인' })).toBeTruthy()
    expect(deleteAllPersonalData).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('group', { name: '기록 삭제 확인' })).toBeNull()
    expect(deleteAllPersonalData).not.toHaveBeenCalled()
  })

  it('확인하면 선택한 범위로 지우고 결과를 알려 준다', async () => {
    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '모든 기록 지우기' }))
    fireEvent.click(screen.getByLabelText('알림 설정과 처음 설문 답변도 함께 지우기'))
    fireEvent.click(screen.getByRole('button', { name: '지우기' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('모든 기록을 지웠어요'))
    expect(deleteAllPersonalData).toHaveBeenCalledWith({ includePreferences: true })
    expect(screen.queryByRole('group', { name: '기록 삭제 확인' })).toBeNull()
  })

  it('기본 삭제는 설정·설문을 남긴다', async () => {
    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '모든 기록 지우기' }))
    fireEvent.click(screen.getByRole('button', { name: '지우기' }))
    await waitFor(() => expect(deleteAllPersonalData).toHaveBeenCalledWith({ includePreferences: false }))
  })

  it('내보내기는 JSON 파일을 만들고 기록 개수를 알려 준다', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '기록 파일로 내보내기 (JSON)' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/기록 3개로 파일 다운로드를 시작했어요/))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock'), { timeout: 2000 })
    click.mockRestore()
  })

  it('확인 단계를 열면 취소에, 닫으면 지우기 버튼에 포커스가 간다', () => {
    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '모든 기록 지우기' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '취소' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '모든 기록 지우기' }))
  })

  it('측정 중이면 지우지 않고 측정을 멈추라고 알려 준다', async () => {
    deleteAllPersonalData.mockRejectedValueOnce(new MeasurementActiveError())
    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '모든 기록 지우기' }))
    fireEvent.click(screen.getByRole('button', { name: '지우기' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/측정이 진행 중이에요/))
  })

  it('삭제에 실패하면 이유와 다음 행동을 알려 준다', async () => {
    deleteAllPersonalData.mockRejectedValueOnce(new Error('blocked'))
    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '모든 기록 지우기' }))
    fireEvent.click(screen.getByRole('button', { name: '지우기' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/지우지 못했어요/))
  })

  it('가져오기 버튼은 파일 선택 창을 연다', () => {
    render(<DataManagement />)
    const input = screen.getByLabelText('가져올 기록 파일') as HTMLInputElement
    const click = vi.spyOn(input, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: '기록 파일 가져오기' }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('파일을 고르면 가져오고 결과를 알려 준다', async () => {
    render(<DataManagement />)
    chooseFile('{"schemaVersion":2}')
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        '기록 5개를 가져왔어요. 이미 있던 2개는 건너뛰었어요. 읽을 수 없는 1개는 빼고 가져왔어요. 이 기기의 설정은 그대로 두었어요',
      ),
    )
    expect(parsePersonalDataImport).toHaveBeenCalledWith('{"schemaVersion":2}')
    expect(importPersonalData).toHaveBeenCalledTimes(1)
  })

  it('온마음 파일이 아니면 이유를 알려 주고 저장하지 않는다', async () => {
    parsePersonalDataImport.mockImplementationOnce(() => {
      throw new ImportFormatError('notJson')
    })
    render(<DataManagement />)
    chooseFile('hello')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('온마음에서 내보낸 기록 파일(JSON)이 아니에요'))
    expect(importPersonalData).not.toHaveBeenCalled()
  })

  it('너무 큰 파일은 읽지 않는다', async () => {
    render(<DataManagement />)
    chooseFile('x'.repeat(1001))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/너무 커서/))
    expect(parsePersonalDataImport).not.toHaveBeenCalled()
  })

  it('측정 중이면 가져오지 않고 측정을 멈추라고 알려 준다', async () => {
    importPersonalData.mockRejectedValueOnce(new MeasurementActiveError())
    render(<DataManagement />)
    chooseFile('{}')
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/측정이 진행 중이에요/))
  })
})
