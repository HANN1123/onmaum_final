import { expect, it } from 'vitest'
import { resultVerdict } from '@/features/ui/measure/demo/demoCopy'

it('결과 문장은 가장 많았던 표정을 꾸밈말로 말한다(감정 이름에 "한"을 붙이지 않는다)', () => {
  expect(resultVerdict('calm')).toBe('평온한 표정이 가장 많았습니다')
  expect(resultVerdict('happy')).toBe('기쁜 표정이 가장 많았습니다')
  expect(resultVerdict('sad')).toBe('슬픈 표정이 가장 많았습니다')
  expect(resultVerdict('angry')).toBe('화난 표정이 가장 많았습니다')
})

it('얼굴을 찾지 못했으면 표정 기록이 없다고 말한다', () => {
  expect(resultVerdict(null)).toBe('얼굴을 찾지 못해 표정 기록이 없습니다')
})
