/** 이름 칸에 겹쳐 그리는 글자 하나. id 가 새로 생긴 글자만 떠오르며 나타난다. */
export interface TypedChar {
  id: number
  ch: string
  /** 한 번에 여러 글자가 들어왔을 때(붙여넣기) 그 안에서의 순서. 나타나는 시차에 쓴다. */
  k: number
  /** 저장해 둔 이름을 되살린 글자. 처음부터 있던 글자라 떠오르지 않는다. */
  still?: boolean
}

/**
 * 입력값이 바뀌었을 때 글자마다 id 를 이어 붙인다.
 * 앞뒤로 같은 글자는 id 를 지키고, 바뀐 가운데 부분은 자리끼리 짝지어 id 를 물려준다.
 * 그래서 한글을 조합하는 동안(ㄱ→기→김) 같은 자리의 글자는 다시 나타나지 않고,
 * 새로 생긴 자리의 글자만 새 id 를 받는다.
 */
export function nextTypedChars(
  prev: readonly TypedChar[],
  value: string,
  nextId: number,
): { chars: TypedChar[]; nextId: number } {
  const next = Array.from(value)
  let start = 0
  while (start < prev.length && start < next.length && prev[start].ch === next[start]) start += 1
  let end = 0
  while (
    end < prev.length - start &&
    end < next.length - start &&
    prev[prev.length - 1 - end].ch === next[next.length - 1 - end]
  ) {
    end += 1
  }

  const oldMid = prev.slice(start, prev.length - end)
  const newMid = next.slice(start, next.length - end)
  let id = nextId
  const mid = newMid.map((ch, j) =>
    j < oldMid.length ? { ...oldMid[j], ch } : { id: id++, ch, k: j - oldMid.length },
  )
  return { chars: [...prev.slice(0, start), ...mid, ...prev.slice(prev.length - end)], nextId: id }
}
