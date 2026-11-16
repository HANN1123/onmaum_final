// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAIN_WINDOW_MIN_SIZE, MAIN_WINDOW_SIZE, resolveMainWindowSize } from '@/features/electron/main/mainWindowSize'

describe('resolveMainWindowSize', () => {
  it('작업 영역이 넉넉하면 기본 1280×900 과 최소 520×700 을 그대로 쓴다', () => {
    expect(resolveMainWindowSize({ width: 2048, height: 1232 })).toEqual({
      width: MAIN_WINDOW_SIZE.width,
      height: MAIN_WINDOW_SIZE.height,
      minWidth: MAIN_WINDOW_MIN_SIZE.width,
      minHeight: MAIN_WINDOW_MIN_SIZE.height,
    })
    expect(MAIN_WINDOW_SIZE).toEqual({ width: 1280, height: 900 })
  })

  it('1366×768 노트북(작업 영역 높이 약 728)에서는 높이를 작업 영역에 맞춘다', () => {
    expect(resolveMainWindowSize({ width: 1366, height: 728 })).toEqual({ width: 1280, height: 728, minWidth: 520, minHeight: 700 })
  })

  it('작업 영역이 최소 크기보다 작으면 최소 크기도 작업 영역에 맞춰 줄인다', () => {
    expect(resolveMainWindowSize({ width: 480, height: 600 })).toEqual({ width: 480, height: 600, minWidth: 480, minHeight: 600 })
  })
})
