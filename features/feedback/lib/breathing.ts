/**
 * 호흡 안내: 순환 한숨 호흡(cyclic sighing)과 숨 참기 없는 느린 호흡.
 *
 * 근거
 * - Balban MY 외(2023). Brief structured respiration practices enhance mood and reduce physiological arousal.
 *   Cell Reports Medicine 4(1):100895. doi:10.1016/j.xcrm.2022.100895
 *   하루 5분, 28일 원격 무작위 연구(108명 무작위 배정). 순환 한숨 호흡은 마음챙김 명상보다
 *   긍정 정서 증가와 호흡수 감소가 컸다. 부정 정서·불안 감소는 모든 군에서 나타났고 군 간 차이는 없었다.
 *   심박변이도·안정 심박은 유의하게 변하지 않았다.
 * - Shao R, Man ISC, Lee TMC(2024). The Effect of Slow-Paced Breathing on Cardiovascular and Emotion Functions:
 *   A Meta-Analysis and Systematic Review. Mindfulness 15:1–18. doi:10.1007/s12671-023-02294-2
 *   31편(1,133명). 느린 호흡은 혈압·심박변이도를 단기 개선했고, 스트레스 감소 효과는 경계 수준이었다.
 *
 * 방법(원 연구 안내): 코로 천천히 들이마신 뒤 짧게 한 번 더 들이마셔 폐를 채우고, 입으로 천천히 길게 내쉰다.
 * 원 연구는 속도를 정하지 않았다. 화면에서 따라 하기 쉽도록 들숨 2초 · 한 번 더 1초 · 날숨 5초
 * (한 번에 8초, 1분 약 7회)로 정했다. 이 초는 앱의 안내값이며 연구가 정한 값이 아니다.
 * 한 번 더 들이마시기가 불편한 사람을 위해 숨을 참지 않는 느린 호흡(들숨 4초 · 날숨 6초, 1분 6회)을 함께 둔다.
 * 박스 호흡·4-7-8 은 숨 참기 단계가 있어 응대 사이 짧은 안내의 기본값으로 두지 않았다.
 *
 * 표현 원칙: 치료·진단처럼 말하지 않는다. "연구를 참고한 안내"까지만 말하고, 1분 버전의 효과나
 * 이 앱에서의 효과를 확인했다고 하지 않는다. 어지러우면 멈추라고 늘 함께 안내한다.
 */

export type BreathPhase = 'inhale' | 'topUp' | 'exhale'
export type BreathingTechnique = 'sigh' | 'slow'

export interface BreathStep {
  phase: BreathPhase
  /** 화면에 크게 보일 짧은 안내 */
  label: string
  seconds: number
}

export interface BreathingMethod {
  title: string
  intro: string
  steps: readonly BreathStep[]
}

export const BREATHING_METHODS: Record<BreathingTechnique, BreathingMethod> = {
  sigh: {
    title: '순환 한숨 호흡',
    intro: '들이마시고, 한 번 더 짧게 들이마신 뒤, 길게 내쉬어요. 날숨을 들숨보다 길게 하는 것이 핵심이에요.',
    steps: [
      { phase: 'inhale', label: '코로 천천히 들이마셔요', seconds: 2 },
      { phase: 'topUp', label: '편하다면, 짧게 한 번 더 들이마셔요', seconds: 1 },
      { phase: 'exhale', label: '입으로 길고 부드럽게 내쉬어요', seconds: 5 },
    ],
  },
  slow: {
    title: '느린 호흡',
    intro: '숨을 참지 않고, 들숨보다 날숨을 조금 길게 쉬어요.',
    steps: [
      { phase: 'inhale', label: '천천히 들이마셔요', seconds: 4 },
      { phase: 'exhale', label: '천천히 길게 내쉬어요', seconds: 6 },
    ],
  },
}

export function cycleSeconds(technique: BreathingTechnique): number {
  return BREATHING_METHODS[technique].steps.reduce((sum, s) => sum + s.seconds, 0)
}

/** 짧게(응대 사이) 1분, 연구와 같은 5분 */
export const BREATHING_DURATIONS_SEC = [60, 300] as const
export type BreathingDuration = (typeof BREATHING_DURATIONS_SEC)[number]

export const BREATHING_READY = '편하게 앉아 주세요. 무리하지 말고 편한 만큼만 따라 해 보세요.'
export const BREATHING_DONE = '이제 평소처럼 편하게 숨 쉬세요.'
export const BREATHING_CAUTION = '어지럽거나 숨이 차고 불편하면 바로 멈추고 평소처럼 숨 쉬세요. 억지로 깊게 쉬거나 숨을 참지 않아도 돼요.'
export const BREATHING_DURATION_NOTE: Record<BreathingDuration, string> = {
  60: '잠깐 숨 고르는 1분 안내예요. 이 짧은 버전의 효과는 따로 확인되지 않았어요.',
  300: '하루 5분 연습 연구를 참고한 안내예요. 편한 속도로 해 주세요.',
}
export const BREATHING_SOURCE = '참고: Balban 외(2023) Cell Reports Medicine 4(1):100895 · Shao 외(2024) Mindfulness 15:1–18'

export interface BreathingFrame {
  /** 다 끝났으면 null */
  step: BreathStep | null
  /** 지금 단계 안에서의 진행 0~1 */
  progress: number
  /** 몇 번째 호흡인지(1부터) */
  cycle: number
  /** 남은 초(올림) */
  remainingSec: number
  done: boolean
  /** 안내 원의 크기 0~1. 들숨에 커지고 날숨에 줄어든다(움직임을 줄이는 설정이면 화면이 쓰지 않는다) */
  scale: number
}

const SCALE_AT: Record<BreathingTechnique, Record<BreathPhase, [number, number]>> = {
  sigh: { inhale: [0, 0.8], topUp: [0.8, 1], exhale: [1, 0] },
  slow: { inhale: [0, 1], topUp: [1, 1], exhale: [1, 0] },
}

/** 정한 시간 안에 시작한 호흡은 날숨까지 마친다. 그래서 실제 길이는 호흡 주기의 배수다 */
export function plannedSeconds(durationSec: number, technique: BreathingTechnique = 'sigh'): number {
  const cycle = cycleSeconds(technique)
  return Math.max(1, Math.ceil(durationSec / cycle)) * cycle
}

/** 시작 후 elapsedMs 시점의 안내 상태 */
export function breathingAt(elapsedMs: number, durationSec: number, technique: BreathingTechnique = 'sigh'): BreathingFrame {
  const { steps } = BREATHING_METHODS[technique]
  const cycle = cycleSeconds(technique)
  const total = plannedSeconds(durationSec, technique)
  const elapsed = Math.max(0, elapsedMs) / 1000
  if (elapsed >= total) {
    return { step: null, progress: 1, cycle: total / cycle, remainingSec: 0, done: true, scale: 0 }
  }
  const cycleIndex = Math.floor(elapsed / cycle)
  let within = elapsed - cycleIndex * cycle
  let step = steps[steps.length - 1]
  for (const s of steps) {
    if (within < s.seconds) {
      step = s
      break
    }
    within -= s.seconds
  }
  const progress = Math.min(1, within / step.seconds)
  const [from, to] = SCALE_AT[technique][step.phase]
  // 들숨은 끝으로 갈수록 느려지고, 날숨은 고르게 줄어든다
  const eased = step.phase === 'exhale' ? progress : Math.sin((progress * Math.PI) / 2)
  return {
    step,
    progress,
    cycle: cycleIndex + 1,
    remainingSec: Math.ceil(total - elapsed),
    done: false,
    scale: from + (to - from) * eased,
  }
}
