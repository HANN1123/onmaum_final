import { useCallback, useEffect, useState } from 'react'

/**
 * 감정 상태 옆 표정 그림 방식(2026-11-21, 팀 디자인 비교용). 메뉴에서 고른다.
 * - off: 글자만(기본, 이전 화면 그대로)
 * - line: 단색 선화 얼굴(EmotionFace)
 * - image: 팀원이 그린 색 얼굴 그림(public/demo/faces)
 * 이 기기에만 기억하는 화면 설정이다. 앱 저장 계약(Dexie)과 무관하다.
 */
export type FaceMode = 'off' | 'line' | 'image'

const STORAGE_KEY = 'onmaum_demo_face_icons'

function read(): FaceMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    // 'on' 은 선 그림 하나만 있던 때의 값
    if (v === 'line' || v === 'on') return 'line'
    if (v === 'image') return 'image'
    return 'off'
  } catch {
    return 'off'
  }
}

/** [지금 방식, 방식 고르기]. 이미 켜진 방식을 다시 고르면 끈다 */
export function useFaceIcons(): [FaceMode, (mode: Exclude<FaceMode, 'off'>) => void] {
  const [mode, setMode] = useState<FaceMode>('off')

  useEffect(() => {
    // localStorage 는 클라이언트에서만 — 첫 렌더는 꺼짐으로 서버와 맞추고, 그 뒤 저장된 값을 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(read())
  }, [])

  const choose = useCallback((picked: Exclude<FaceMode, 'off'>) => {
    setMode((prev) => {
      const next: FaceMode = prev === picked ? 'off' : picked
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // 저장할 수 없는 환경이면 이번 화면에서만 바뀐다
      }
      return next
    })
  }, [])

  return [mode, choose]
}
