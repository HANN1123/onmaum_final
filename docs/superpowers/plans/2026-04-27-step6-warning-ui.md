# Step 6 — 위험 경고 UI + 상담 연락처 Implementation Plan

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DailyRisk가 'warning'일 때 사용자에게 부드러운 권유 톤의 모달을 띄우고, 1577-0199/1393 상담 hotline을 모달과 페이지 푸터에 노출. 일상적으로는 SelfCareTip 한 줄 카드를 회전 표시.

**Architecture:** 5개 신규 파일 (hook 1, 컴포넌트 3, lib 1) + page.tsx 수정. 순수 함수(`selfCareTips`)는 TDD 엄격, hook(`useWarningDismissal`)은 sessionStorage mock 테스트, 컴포넌트는 best effort UI 테스트.

**Tech Stack:** TypeScript 5, Next.js 16, React 19, Vitest, @testing-library/react, happy-dom (Step 3에서 셋업됨, 추가 의존성 없음)

**Spec 참조:** `docs/superpowers/specs/2026-04-27-step6-warning-ui-design.md`

---

## File Structure

```
hooks/
  useWarningDismissal.ts        (신규)

components/
  RiskWarningModal.tsx          (신규)
  ContactsFooter.tsx            (신규)
  SelfCareTip.tsx               (현재 빈 파일 → 채움)

lib/
  selfCareTips.ts               (신규)

tests/
  lib/
    selfCareTips.test.ts        (신규)
  hooks/
    useWarningDismissal.test.tsx (신규)
  components/                   (신규 폴더)
    RiskWarningModal.test.tsx
    ContactsFooter.test.tsx
    SelfCareTip.test.tsx

app/page.tsx                    (수정 - 5개 신규 컴포넌트 통합)
```

---

## Task 1: `lib/selfCareTips.ts` (TDD 엄격)

**Files:**
- Create: `tests/lib/selfCareTips.test.ts`
- Create: `lib/selfCareTips.ts`

- [ ] **Step 1: 테스트 작성**

`tests/lib/selfCareTips.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { TIPS, selectRandomTip, type SelfCareTip } from '@/lib/selfCareTips'

describe('TIPS', () => {
  it('최소 5개 이상의 팁을 정의', () => {
    expect(TIPS.length).toBeGreaterThanOrEqual(5)
  })

  it('각 팁은 icon과 text를 가진다', () => {
    for (const tip of TIPS) {
      expect(typeof tip.icon).toBe('string')
      expect(tip.icon.length).toBeGreaterThan(0)
      expect(typeof tip.text).toBe('string')
      expect(tip.text.length).toBeGreaterThan(0)
    }
  })
})

describe('selectRandomTip', () => {
  it('인자 없으면 TIPS 안의 임의 팁 반환', () => {
    const tip = selectRandomTip()
    expect(TIPS).toContain(tip)
  })

  it('currentTip 주어지면 그것과 다른 팁 반환', () => {
    // 100번 시도 — 매번 currentTip이 아닌 것이 나와야 함
    const current = TIPS[0]
    for (let i = 0; i < 100; i++) {
      const next = selectRandomTip(current)
      expect(next).not.toBe(current)
    }
  })

  it('selectRandomTip(current) 결과는 항상 TIPS 안에 있음', () => {
    const current = TIPS[0]
    for (let i = 0; i < 50; i++) {
      const next = selectRandomTip(current)
      expect(TIPS).toContain(next)
    }
  })
})
```

- [ ] **Step 2: 테스트 실행 → fail 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/lib/selfCareTips.test.ts
```

기대: 모듈 not found 또는 export 없음 에러.

- [ ] **Step 3: 구현**

`lib/selfCareTips.ts`:

```typescript
export interface SelfCareTip {
  icon: string
  text: string
}

export const TIPS: SelfCareTip[] = [
  { icon: '💧', text: '물 한 잔 마셔보세요' },
  { icon: '🌬️', text: '천천히 깊게 5번 숨을 들이쉬어 보세요' },
  { icon: '🚶', text: '잠시 일어나 5분만 걸어보세요' },
  { icon: '👀', text: '20초간 먼 곳을 바라보세요' },
  { icon: '🌿', text: '창밖 자연을 한 번 바라보세요' },
  { icon: '🫶', text: '오늘 잘한 일 한 가지를 떠올려보세요' },
  { icon: '☕', text: '따뜻한 차 한 잔 어떠세요' },
  { icon: '📵', text: '5분만 화면에서 눈을 떼어보세요' },
  { icon: '🤲', text: '어깨를 천천히 풀어보세요' },
  { icon: '🛌', text: '오늘 충분히 잘 수 있도록 미리 준비해보세요' },
]

export function selectRandomTip(currentTip?: SelfCareTip): SelfCareTip {
  const candidates = currentTip
    ? TIPS.filter((t) => t !== currentTip)
    : TIPS
  if (candidates.length === 0) {
    // TIPS가 1개뿐인 경우 (실제로는 발생 안 함)
    return TIPS[0]
  }
  const idx = Math.floor(Math.random() * candidates.length)
  return candidates[idx]
}
```

- [ ] **Step 4: 테스트 실행 → pass 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/lib/selfCareTips.test.ts
```

기대: 5/5 모두 pass.

- [ ] **Step 5: 타입체크 + 린트**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint lib tests
```

기대: 출력 없음.

- [ ] **Step 6: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add lib/selfCareTips.ts tests/lib/selfCareTips.test.ts && git commit -m "feat: selfCareTips 정적 리스트 + selectRandomTip TDD"
```

---

## Task 2: `hooks/useWarningDismissal.ts` (TDD 적용)

**Files:**
- Create: `tests/hooks/useWarningDismissal.test.tsx`
- Create: `hooks/useWarningDismissal.ts`

- [ ] **Step 1: 테스트 작성**

`tests/hooks/useWarningDismissal.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWarningDismissal } from '@/hooks/useWarningDismissal'

describe('useWarningDismissal', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('sessionStorage 비어있음 → dismissed=false 초기값', () => {
    const { result } = renderHook(() => useWarningDismissal('2026-04-27'))
    expect(result.current.dismissed).toBe(false)
  })

  it('dismiss() 호출 → dismissed=true 변경', () => {
    const { result } = renderHook(() => useWarningDismissal('2026-04-27'))
    act(() => {
      result.current.dismiss()
    })
    expect(result.current.dismissed).toBe(true)
  })

  it('dismiss() 호출 → sessionStorage에 저장', () => {
    const { result } = renderHook(() => useWarningDismissal('2026-04-27'))
    act(() => {
      result.current.dismiss()
    })
    expect(sessionStorage.getItem('onmaum-warning-dismissed-2026-04-27')).toBe(
      'true',
    )
  })

  it('같은 date로 재마운트 → dismissed=true 유지 (sessionStorage 읽음)', () => {
    sessionStorage.setItem('onmaum-warning-dismissed-2026-04-27', 'true')
    const { result } = renderHook(() => useWarningDismissal('2026-04-27'))
    expect(result.current.dismissed).toBe(true)
  })

  it('다른 date → dismissed=false (별도 key)', () => {
    sessionStorage.setItem('onmaum-warning-dismissed-2026-04-27', 'true')
    const { result } = renderHook(() => useWarningDismissal('2026-04-28'))
    expect(result.current.dismissed).toBe(false)
  })

  it('date prop 변경 → dismissed 자동 reset', () => {
    sessionStorage.setItem('onmaum-warning-dismissed-2026-04-27', 'true')
    const { result, rerender } = renderHook(
      ({ date }) => useWarningDismissal(date),
      { initialProps: { date: '2026-04-27' } },
    )
    expect(result.current.dismissed).toBe(true)

    rerender({ date: '2026-04-28' })
    expect(result.current.dismissed).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실행 → fail 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/hooks/useWarningDismissal.test.tsx
```

기대: 모듈 not found.

- [ ] **Step 3: 구현**

`hooks/useWarningDismissal.ts`:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'

interface Result {
  dismissed: boolean
  dismiss: () => void
}

function storageKey(date: string): string {
  return `onmaum-warning-dismissed-${date}`
}

function readDismissed(date: string): boolean {
  try {
    return sessionStorage.getItem(storageKey(date)) === 'true'
  } catch {
    // sessionStorage 접근 실패 (시크릿 모드 일부) → 안전 측: false
    return false
  }
}

export function useWarningDismissal(date: string): Result {
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed(date))

  // date prop이 바뀌면 새 key로 다시 읽어오기
  useEffect(() => {
    setDismissed(readDismissed(date))
  }, [date])

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey(date), 'true')
    } catch (err) {
      console.error('sessionStorage 쓰기 실패:', err)
    }
    setDismissed(true)
  }, [date])

  return { dismissed, dismiss }
}
```

- [ ] **Step 4: 테스트 실행 → pass 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/hooks/useWarningDismissal.test.tsx
```

기대: 6/6 pass.

- [ ] **Step 5: 타입체크 + 린트**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint hooks tests
```

기대: 출력 없음. (`set-state-in-effect` 잡힐 가능성 있음 — date 변경 effect의 setState. 잡히면 inline disable + 주석 추가)

- [ ] **Step 6: ESLint 에러 처리 (필요 시)**

만약 `react-hooks/set-state-in-effect` 에러가 나면 `hooks/useWarningDismissal.ts`의 useEffect 부분을 다음으로 수정:

```typescript
  // date prop이 바뀌면 새 key로 다시 읽어오기. cascading render 아님 (date 변경 시만).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setDismissed(readDismissed(date))
  }, [date])
```

다시 ESLint 실행해서 통과 확인.

- [ ] **Step 7: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add hooks/useWarningDismissal.ts tests/hooks/useWarningDismissal.test.tsx && git commit -m "feat: useWarningDismissal hook + TDD (sessionStorage 기반)"
```

---

## Task 3: `components/RiskWarningModal.tsx`

**Files:**
- Create: `tests/components/RiskWarningModal.test.tsx`
- Create: `components/RiskWarningModal.tsx`

- [ ] **Step 1: 구현**

`components/RiskWarningModal.tsx`:

```typescript
'use client'

import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

export default function RiskWarningModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="risk-warning-title"
          className="text-center text-xl font-semibold text-ink-900"
        >
          🌿 잠시 마음을 살펴요
        </h2>
        <p className="mt-3 text-center text-sm text-ink-600 leading-relaxed">
          최근 마음 상태가 평소와 다릅니다.
          <br />
          잠시 쉬어가거나 도움을 받아보는 것은 어떨까요?
        </p>

        <div className="mt-5 space-y-2 rounded-xl bg-ink-50 p-4">
          <p className="text-xs text-ink-500 text-center">상담 전화 (24시간)</p>
          <a
            href="tel:1577-0199"
            className="block text-center text-base font-medium text-ink-900 hover:text-risk-good"
          >
            📞 1577-0199 정신건강위기상담
          </a>
          <a
            href="tel:1393"
            className="block text-center text-base font-medium text-ink-900 hover:text-risk-good"
          >
            📞 1393 자살예방상담
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-risk-good px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
        >
          알겠어요
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 테스트 작성**

`tests/components/RiskWarningModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RiskWarningModal from '@/components/RiskWarningModal'

describe('RiskWarningModal', () => {
  it('open=false → 렌더되지 않음 (null)', () => {
    const { container } = render(
      <RiskWarningModal open={false} onClose={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('open=true → 헤드/카피/연락처/버튼 모두 보임', () => {
    render(<RiskWarningModal open={true} onClose={() => {}} />)
    expect(screen.getByText(/잠시 마음을 살펴요/)).toBeInTheDocument()
    expect(screen.getByText(/평소와 다릅니다/)).toBeInTheDocument()
    expect(screen.getByText(/1577-0199/)).toBeInTheDocument()
    expect(screen.getByText(/1393/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '알겠어요' })).toBeInTheDocument()
  })

  it('연락처 tel: 링크 attribute 정확', () => {
    render(<RiskWarningModal open={true} onClose={() => {}} />)
    const link0199 = screen.getByText(/1577-0199/).closest('a')
    const link1393 = screen.getByText(/1393/).closest('a')
    expect(link0199?.getAttribute('href')).toBe('tel:1577-0199')
    expect(link1393?.getAttribute('href')).toBe('tel:1393')
  })

  it('"알겠어요" 클릭 → onClose 호출', () => {
    const onClose = vi.fn()
    render(<RiskWarningModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '알겠어요' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('배경 클릭 → onClose 호출', () => {
    const onClose = vi.fn()
    render(<RiskWarningModal open={true} onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('내부 컨텐츠 클릭은 onClose 호출 안 함 (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<RiskWarningModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText(/잠시 마음을 살펴요/))
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 테스트 실행 → pass 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/components/RiskWarningModal.test.tsx
```

기대: 6/6 pass. ESC 키 테스트는 happy-dom의 키보드 이벤트가 다를 수 있어 skip (best effort).

- [ ] **Step 4: 타입체크 + 린트**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint components tests
```

기대: 출력 없음.

- [ ] **Step 5: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add components/RiskWarningModal.tsx tests/components/RiskWarningModal.test.tsx && git commit -m "feat: RiskWarningModal 컴포넌트 + 테스트 (open/close/tel 링크/배경 클릭)"
```

---

## Task 4: `features/ui/common/ContactsFooter.tsx`

**Files:**
- Create: `tests/ui/common/ContactsFooter.test.tsx`
- Create: `features/ui/common/ContactsFooter.tsx`

- [ ] **Step 1: 구현**

`features/ui/common/ContactsFooter.tsx`:

```typescript
export default function ContactsFooter() {
  return (
    <footer className="mt-8 border-t border-ink-200 pt-4 pb-2 text-center text-xs text-ink-500">
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
```

- [ ] **Step 2: 테스트 작성**

`tests/ui/common/ContactsFooter.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ContactsFooter from '@/features/ui/common/ContactsFooter'

describe('ContactsFooter', () => {
  it('1577-0199, 1393 텍스트 노출', () => {
    render(<ContactsFooter />)
    expect(screen.getByText(/1577-0199/)).toBeInTheDocument()
    expect(screen.getByText(/1393/)).toBeInTheDocument()
  })

  it('tel: 링크 attribute 정확', () => {
    render(<ContactsFooter />)
    const link0199 = screen.getByText(/1577-0199/).closest('a')
    const link1393 = screen.getByText(/1393/).closest('a')
    expect(link0199?.getAttribute('href')).toBe('tel:1577-0199')
    expect(link1393?.getAttribute('href')).toBe('tel:1393')
  })

  it('"도움이 필요하면" 권유 톤 카피 노출', () => {
    render(<ContactsFooter />)
    expect(screen.getByText(/도움이 필요하면/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 테스트 실행 → pass 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/ui/common/ContactsFooter.test.tsx
```

기대: 3/3 pass.

- [ ] **Step 4: 타입체크 + 린트**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint components tests
```

기대: 출력 없음.

- [ ] **Step 5: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add features/ui/common/ContactsFooter.tsx tests/ui/common/ContactsFooter.test.tsx && git commit -m "feat: ContactsFooter (1577-0199 + 1393 푸터 항상 노출)"
```

---

## Task 5: `components/SelfCareTip.tsx` (현재 빈 파일 → 채움)

**Files:**
- Create: `tests/components/SelfCareTip.test.tsx`
- Modify: `components/SelfCareTip.tsx` (현재 빈 파일)

- [ ] **Step 1: 구현**

`components/SelfCareTip.tsx` 파일 내용 (덮어쓰기):

```typescript
'use client'

import { useState } from 'react'
import { selectRandomTip, type SelfCareTip as Tip } from '@/lib/selfCareTips'

export default function SelfCareTip() {
  const [tip, setTip] = useState<Tip>(() => selectRandomTip())

  const handleNext = () => {
    setTip((current) => selectRandomTip(current))
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-700">
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{tip.icon}</span>
        <span>{tip.text}</span>
      </div>
      <button
        type="button"
        onClick={handleNext}
        aria-label="다른 팁 보기"
        className="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
      >
        🔄
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 테스트 작성**

`tests/components/SelfCareTip.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SelfCareTip from '@/components/SelfCareTip'
import { TIPS } from '@/lib/selfCareTips'

describe('SelfCareTip', () => {
  it('초기 렌더 시 TIPS 안의 팁 표시', () => {
    render(<SelfCareTip />)
    const allTexts = TIPS.map((t) => t.text)
    const matched = allTexts.find((text) => screen.queryByText(text))
    expect(matched).toBeDefined()
  })

  it('🔄 버튼 클릭 → 다른 팁으로 교체', () => {
    render(<SelfCareTip />)
    const initialText = TIPS.find((t) => screen.queryByText(t.text))!.text
    const button = screen.getByLabelText('다른 팁 보기')

    // TIPS가 충분히 많아서 (10개) 한 번 클릭으로 다른 팁 확률 높음.
    // 그래도 보장하기 위해 최대 10번 시도.
    let changed = false
    for (let i = 0; i < 10; i++) {
      fireEvent.click(button)
      const stillSame = screen.queryByText(initialText)
      if (!stillSame) {
        changed = true
        break
      }
    }
    expect(changed).toBe(true)
  })

  it('팁이 항상 TIPS 안의 것', () => {
    render(<SelfCareTip />)
    const button = screen.getByLabelText('다른 팁 보기')
    for (let i = 0; i < 5; i++) {
      fireEvent.click(button)
      const visible = TIPS.some((t) => screen.queryByText(t.text))
      expect(visible).toBe(true)
    }
  })
})
```

- [ ] **Step 3: 테스트 실행 → pass 확인**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run -- tests/components/SelfCareTip.test.tsx
```

기대: 3/3 pass. selectRandomTip이 randomness 있어서 가끔 같은 tip이 연속 나올 수 있지만, current와 다른 것 보장하므로 한 번 클릭이면 무조건 변경됨.

- [ ] **Step 4: 타입체크 + 린트**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint components tests
```

기대: 출력 없음.

- [ ] **Step 5: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add components/SelfCareTip.tsx tests/components/SelfCareTip.test.tsx && git commit -m "feat: SelfCareTip 한 줄 카드 + 회전 버튼"
```

---

## Task 6: `app/page.tsx` 통합 + 브라우저 수동 검증

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: page.tsx 수정**

`app/page.tsx` 파일 다음으로 수정:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import CameraView from '@/features/camera/components/CameraView'
import ContactsFooter from '@/features/ui/common/ContactsFooter'
import DailyRiskCard from '@/components/DailyRiskCard'
import EmotionDisplay from '@/features/ui/measure/EmotionDisplay'
import RecentRecords from '@/features/ui/report/RecentRecords'
import RiskWarningModal from '@/components/RiskWarningModal'
import SelfCareTip from '@/components/SelfCareTip'
import TrendChart from '@/features/ui/report/TrendChart'
import { useEmotionRecorder } from '@/features/camera/hooks/useEmotionRecorder'
import { useWarningDismissal } from '@/hooks/useWarningDismissal'
import { db } from '@/shared/storage/db'
import { loadFaceApiModels } from '@/features/camera/lib/faceDetection'
import { getEmotionsByDate } from '@/shared/storage/emotionRepository'
import { aggregateDailyRisk } from '@/features/algorithm/stress/riskCalculator'

type ModelStatus = 'loading' | 'ready' | 'error'

export default function Home() {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [modelError, setModelError] = useState<string | null>(null)
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadFaceApiModels()
      .then(() => {
        if (cancelled) return
        console.log('✅ face-api 모델 로드 완료')
        setModelStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        console.error('❌ face-api 모델 로드 실패:', err)
        setModelError(message)
        setModelStatus('error')
      })

    db.open()
      .then(() => {
        if (cancelled) return
        console.log('✅ IndexedDB 준비 완료')
        setDbReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        console.error('❌ IndexedDB open 실패:', err)
        setDbError(message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const { currentEmotion, saveError } = useEmotionRecorder({
    active,
    videoEl,
  })

  // Step 6: 위험 경고 트리거
  const today = new Date().toLocaleDateString('en-CA')
  const todayRecords = useLiveQuery(() => getEmotionsByDate(today), [today])
  const todayRisk = todayRecords ? aggregateDailyRisk(todayRecords, today) : null
  const { dismissed, dismiss } = useWarningDismissal(today)
  const showWarning = todayRisk?.riskLevel === 'warning' && !dismissed

  const handleCameraReady = useCallback((video: HTMLVideoElement) => {
    setVideoEl(video)
    setCameraError(null)
  }, [])

  const handleCameraError = useCallback((err: Error) => {
    setCameraError(err.message)
    setActive(false)
    setVideoEl(null)
  }, [])

  const handleStart = () => {
    if (modelStatus !== 'ready' || !dbReady) return
    setCameraError(null)
    setActive(true)
  }

  const handleStop = () => {
    setActive(false)
    setVideoEl(null)
  }

  const startDisabled = active || modelStatus !== 'ready' || !dbReady

  return (
    <main className="min-h-screen bg-ink-50 px-6 py-12">
      <section className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-ink-900">온마음</h1>
          <p className="mt-2 text-sm text-ink-500">
            Step 6 · 위험 경고 + 자기 돌봄
          </p>
        </header>

        {modelStatus === 'loading' && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-ink-600">
            ⏳ face-api 모델 로딩 중...
          </div>
        )}
        {modelStatus === 'error' && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 모델 로드 실패: {modelError}
          </div>
        )}
        {dbError && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 데이터 저장 불가 환경입니다 (IndexedDB): {dbError}
          </div>
        )}

        <DailyRiskCard />

        <TrendChart />

        <SelfCareTip />

        <CameraView
          active={active}
          onReady={handleCameraReady}
          onError={handleCameraError}
        />

        {cameraError && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 카메라 오류: {cameraError}
          </div>
        )}

        {saveError && (
          <div className="rounded-2xl border border-ink-200 bg-white p-4 text-center text-sm text-risk-warning">
            ❌ 데이터 저장 실패: {saveError.message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleStart}
            disabled={startDisabled}
            className="flex-1 rounded-full bg-risk-good px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            측정 시작
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={!active}
            className="flex-1 rounded-full border border-ink-300 bg-white px-6 py-3 font-medium text-ink-700 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            측정 정지
          </button>
        </div>

        {active && <EmotionDisplay emotion={currentEmotion} />}

        <RecentRecords />

        <ContactsFooter />
      </section>

      <RiskWarningModal open={showWarning} onClose={dismiss} />
    </main>
  )
}
```

> 변경 요약:
> - `useLiveQuery` import 추가
> - `useWarningDismissal`, `aggregateDailyRisk`, `getEmotionsByDate` import 추가
> - `RiskWarningModal`, `SelfCareTip`, `ContactsFooter` import 추가
> - `today` / `todayRecords` / `todayRisk` / `dismissed` / `showWarning` state 추가
> - JSX에 `<SelfCareTip />` (TrendChart 아래), `<ContactsFooter />` (페이지 맨 아래), `<RiskWarningModal>` (main 바깥, JSX 마지막)
> - 헤더 텍스트: "Step 6 · 위험 경고 + 자기 돌봄"

- [ ] **Step 2: 타입체크 + 린트**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npx tsc --noEmit && npx eslint app lib hooks components tests
```

기대: 출력 없음.

- [ ] **Step 3: 전체 테스트 실행**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run test:run
```

기대: 기존 34 + 신규 (selfCareTips 5 + useWarningDismissal 6 + RiskWarningModal 6 + ContactsFooter 3 + SelfCareTip 3) = 약 57 pass + 4 skipped.

- [ ] **Step 4: dev 서버 + 브라우저 수동 검증**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && npm run dev
```

브라우저(http://localhost:3000) 새로고침 후 확인:

1. **헤더**: "Step 6 · 위험 경고 + 자기 돌봄"
2. **DailyRiskCard**: 기존 동작
3. **TrendChart**: 기존 동작
4. **SelfCareTip 카드**: TrendChart 아래에 한 줄 카드 등장. 🔄 클릭 시 다른 팁 교체
5. **ContactsFooter**: 페이지 맨 아래 "도움이 필요하면: 📞 1577-0199 · 📞 1393" 작은 글씨
6. **RecentRecords**: 기존 동작
7. **RiskWarningModal 트리거 테스트**:
   - 현재 today risk가 'warning'이면 모달 자동 등장
   - 만약 'warning'이 아니면 IndexedDB에 강제로 부정 감정 record 추가하거나, 측정 시작 후 의도적으로 화남/슬픔 표정 1분간 유지
   - 모달 등장 → "🌿 잠시 마음을 살펴요" 헤드 + 본문 + 1577-0199/1393 + "알겠어요" 버튼
   - "알겠어요" 클릭 → 모달 닫힘
   - 새로고침 → 모달 안 다시 뜸 (sessionStorage)
   - 새 탭에서 같은 페이지 → 모달 다시 뜸 (sessionStorage 분리)

수동 검증 OK 시 다음 단계.

- [ ] **Step 5: commit**

```bash
cd "/Users/woo-bin/3.1 team pj/ONMAUM" && git add app/page.tsx && git commit -m "feat: Step 6 - 위험 경고 모달 + SelfCareTip + ContactsFooter 통합"
```

---

## Verification Checklist (Step 6 완료 확인)

implementation 끝나고 `superpowers:verification-before-completion` 적용:

- [ ] `npm run test:run` 모두 pass (~57 + 4 skipped)
- [ ] `npx tsc --noEmit` 출력 없음
- [ ] `npx eslint app lib hooks components tests` 출력 없음
- [ ] 브라우저 수동 테스트:
  - SelfCareTip 한 줄 카드 + 🔄 회전 동작
  - ContactsFooter 푸터에 항상 노출
  - tel: 링크 클릭 시 (모바일) 전화 연결 (데스크톱은 OS별)
  - DailyRisk가 'warning'일 때 모달 자동 등장
  - 모달 "알겠어요" 클릭 → 닫힘 + sessionStorage 저장
  - 새로고침 → 모달 안 다시 뜸 (같은 세션)
  - 새 탭 → 모달 다시 뜸 (다른 sessionStorage)

---

## Out of Scope (Step 7 이후)

- 로컬 알림 (브라우저 Notifications API) → Step 7
- 알림 권한 요청 UX → Step 7
- PWA (manifest, service worker, 오프라인) → Step 8
- Vercel 배포 → Step 9
- 자기 돌봄 팁 데이터베이스화 → 향후

---

## 참고 메모

- **모달이 측정 중 갑자기 등장 가능**: 의도대로. 실시간 위험 신호 즉시 안내.
- **risk 악화 시 재등장 안 함**: 같은 날 dismiss 후에는 안 뜸 (사용자 통제권 존중)
- **여러 탭 동기화 안 함**: sessionStorage 의도적 분리
- **sessionStorage vs localStorage**: sessionStorage 선택 (새 세션마다 안전망 다시 보임)
- **RiskWarningModal에 ESC 키 핸들러**: window.addEventListener('keydown') 사용. 테스트는 best effort.
