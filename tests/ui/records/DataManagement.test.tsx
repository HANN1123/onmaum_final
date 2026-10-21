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
}))

import DataManagement from '@/features/ui/records/DataManagement'

beforeEach(() => {
  deleteAllPersonalData.mockClear()
  exportPersonalData.mockClear()
})

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

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('기록 3개를 파일로 저장했어요'))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    click.mockRestore()
  })

  it('삭제에 실패하면 이유와 다음 행동을 알려 준다', async () => {
    deleteAllPersonalData.mockRejectedValueOnce(new Error('blocked'))
    render(<DataManagement />)
    fireEvent.click(screen.getByRole('button', { name: '모든 기록 지우기' }))
    fireEvent.click(screen.getByRole('button', { name: '지우기' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/지우지 못했어요/))
  })
})
