import type { Metadata } from 'next'
import OrbLab from '@/features/ui/measure/demo/OrbLab'

export const metadata: Metadata = {
  title: '온마음 — 오브 후보',
}

// 측정 시안에 쓸 오브 후보 비교 화면.
export default function OrbLabPage() {
  return <OrbLab />
}
