/** 측정 화면 시안 식별자. 서버(route)와 클라이언트(화면)가 함께 쓰므로 'use client' 없는 모듈에 둔다. */
export const MEASURE_DEMO_VARIANTS = ['a', 'b', 'c'] as const
export type MeasureDemoVariant = (typeof MEASURE_DEMO_VARIANTS)[number]

export function isMeasureDemoVariant(value: string): value is MeasureDemoVariant {
  return (MEASURE_DEMO_VARIANTS as readonly string[]).includes(value)
}
