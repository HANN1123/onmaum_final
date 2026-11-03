import { describe, it, expect } from 'vitest'
import { nextTypedChars, type TypedChar } from '@/features/ui/landing/hero-demo/typedChars'

/** 빈 칸에서 값들을 차례로 넣어 본 결과. */
function typeSequence(values: string[]) {
  let chars: TypedChar[] = []
  let nextId = 0
  const steps = values.map((value) => {
    const result = nextTypedChars(chars, value, nextId)
    chars = result.chars
    nextId = result.nextId
    return chars
  })
  return steps
}

const ids = (chars: TypedChar[]) => chars.map((c) => c.id)
const text = (chars: TypedChar[]) => chars.map((c) => c.ch).join('')

describe('nextTypedChars', () => {
  it('뒤에 붙은 글자만 새 id 를 받고, 있던 글자는 id 를 지킨다', () => {
    const [first, second] = typeSequence(['a', 'ab'])
    expect(ids(first)).toEqual([0])
    expect(ids(second)).toEqual([0, 1])
    expect(text(second)).toBe('ab')
  })

  it('한글을 조합하는 동안(ㄱ→기→김) 같은 자리의 글자는 id 가 그대로다', () => {
    const steps = typeSequence(['ㄱ', '기', '김', '김ㅇ', '김우'])
    expect(steps.map(ids)).toEqual([[0], [0], [0], [0, 1], [0, 1]])
    expect(text(steps[4])).toBe('김우')
  })

  it('받침이 다음 글자로 넘어가면(각→가가) 앞 글자는 그대로, 뒤 글자만 새로 나온다', () => {
    const steps = typeSequence(['가', '각', '가가'])
    expect(steps.map(ids)).toEqual([[0], [0], [0, 1]])
  })

  it('가운데에 끼운 글자만 새로 나오고 뒤 글자는 id 를 지킨다', () => {
    const [before, after] = typeSequence(['가다', '가나다'])
    expect(ids(before)).toEqual([0, 1])
    expect(ids(after)).toEqual([0, 2, 1])
  })

  it('지운 글자만 빠지고 나머지는 id 를 지킨다', () => {
    const [, after] = typeSequence(['가나다', '가다'])
    expect(ids(after)).toEqual([0, 2])
    expect(text(after)).toBe('가다')
  })

  it('되살린 글자(still)는 고쳐도 표시를 지키고, 새로 친 글자에는 붙지 않는다', () => {
    const restored = nextTypedChars([], '김우', 0).chars.map((c) => ({ ...c, still: true }))
    const { chars } = nextTypedChars(restored, '김우빈', 2)
    expect(chars.map((c) => c.still ?? false)).toEqual([true, true, false])
  })

  it('한 번에 여러 글자가 들어오면(붙여넣기) 순서 k 가 0 부터 매겨진다', () => {
    const [, pasted] = typeSequence(['김', '김우빈'])
    expect(pasted.map((c) => c.k)).toEqual([0, 0, 1])
  })
})
