'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './measureDemo.module.css'

/** 메뉴 항목 하나: 다른 화면으로 가는 링크(href) 또는 이 화면의 동작(onSelect) */
export interface NavMenuItem {
  key: string
  label: string
  /** 항목 아래 한 줄 설명. 누르면 무엇이 나오는지 알 수 있게 한다 */
  hint?: string
  icon: ReactNode
  href?: string
  onSelect?: () => void
}

/**
 * 위쪽 "메뉴" 버튼과 펼침 목록(2026-11-20 교수님 피드백).
 * 글자만 늘어놓은 링크는 기능처럼 보이지 않아, 테두리 있는 버튼 하나를 누르면 항목이 펼쳐지게 했다.
 * 바깥을 누르거나 Esc 를 누르면 닫히고, 위·아래 화살표로 항목을 옮겨 다닌다.
 */
export default function NavMenu({ items }: { items: NavMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  const menuItems = () => [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

  useEffect(() => {
    if (!open) return
    // 펼치면 첫 항목에 초점을 둔다
    menuItems()[0]?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const all = menuItems()
    const at = all.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? all.length - 1
        : (at + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length
    all[next]?.focus()
  }

  return (
    <div ref={rootRef} className={styles.menuRoot}>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.menuBtn} ${styles.focusable}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        <svg className={styles.menuIcon} viewBox="0 0 16 16" aria-hidden="true">
          {open ? <path d="M3 3 13 13M13 3 3 13" /> : <path d="M2 4h12M2 8h12M2 12h12" />}
        </svg>
        메뉴
      </button>
      {open && (
        <div ref={listRef} id={listId} className={styles.menuList} role="menu" aria-label="메뉴" onKeyDown={onListKey}>
          {items.map((item) => {
            const body = (
              <>
                <span className={styles.menuItemIcon} aria-hidden="true">{item.icon}</span>
                <span className={styles.menuItemText}>
                  <span className={styles.menuItemLabel}>{item.label}</span>
                  {item.hint && <span className={styles.menuItemHint}>{item.hint}</span>}
                </span>
              </>
            )
            return item.href ? (
              <Link key={item.key} href={item.href} role="menuitem" className={`${styles.menuItem} ${styles.focusable}`} onClick={() => close(false)}>
                {body}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.focusable}`}
                onClick={() => {
                  close(true)
                  item.onSelect?.()
                }}
              >
                {body}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
