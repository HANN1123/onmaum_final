import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MeasureDemo from '@/features/ui/measure/demo/MeasureDemo'
import { MEASURE_DEMO_VARIANTS, isMeasureDemoVariant } from '@/features/ui/measure/demo/variants'

export const metadata: Metadata = {
  title: '온마음 — 측정 화면 시안',
}

export const dynamicParams = false

export function generateStaticParams() {
  return MEASURE_DEMO_VARIANTS.map((variant) => ({ variant }))
}

// 측정 화면 시안 A·B·C. 앱 chrome 은 AppChrome 에서 /demo/measure 아래를 제외한다.
export default async function MeasureDemoPage({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params
  if (!isMeasureDemoVariant(variant)) notFound()
  return <MeasureDemo variant={variant} />
}
