import type { NavMenuItem } from './NavMenu'

/** 메뉴 항목 아이콘(선 1.5px, 글자 색) */
export const MENU_ICON = {
  result: (
    <svg viewBox="0 0 16 16"><path d="M2 14h12M4 11V7M8 11V3M12 11V8" /></svg>
  ),
  breath: (
    <svg viewBox="0 0 16 16"><path d="M1 8c2-4 4-4 6 0s4 4 6 0M1 12c2-2 4-2 6 0s4 2 6 0" /></svg>
  ),
  survey: (
    <svg viewBox="0 0 16 16"><path d="M3 2h10v12H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3" /></svg>
  ),
  measure: (
    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2" fill="currentColor" /></svg>
  ),
  records: (
    <svg viewBox="0 0 16 16"><path d="M2 3.5h12M2 8h12M2 12.5h12" /></svg>
  ),
  about: (
    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><path d="M8 7v4.5M8 4.5v.5" /></svg>
  ),
  face: (
    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><path d="M5.8 9.6c1.2 1.2 3.2 1.2 4.4 0M6 6.4v.6M10 6.4v.6" /></svg>
  ),
  faceImage: (
    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor" fillOpacity="0.25" /><path d="M5.8 9.6c1.2 1.2 3.2 1.2 4.4 0M6 6.4v.6M10 6.4v.6" /></svg>
  ),
  theme: (
    <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" /></svg>
  ),
}

/** 화면 색 바꾸기 메뉴 항목. 측정·결과·리포트 화면이 같은 모양으로 쓴다 */
export function themeMenuItem(theme: 'dark' | 'light', toggle: () => void): NavMenuItem {
  return { key: 'theme', label: theme === 'dark' ? '화이트 모드' : '다크 모드', hint: '화면 색 바꾸기', icon: MENU_ICON.theme, onSelect: toggle }
}
