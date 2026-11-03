/**
 * 심박 입력 자리. rPPG(또는 기준 센서)를 붙일 때 useHeartRateSource 가 실제 값을 돌려주게 바꾼다.
 * 지금은 연결된 심박 원천이 없어 bpm 은 null, 파형은 0 이다. 모의 신호는 만들지 않는다.
 * 화면은 bpm 이 null 이면 숫자 대신 "--" 와 "rPPG 연결 전"을 보여주고, 파형은 평평한 선으로 둔다.
 */
export interface HeartRateSource {
  /** 현재 심박(BPM). 원천이 없거나 신호를 잃으면 null */
  bpm: number | null
  /** 매 프레임 읽는 맥박 파형 값(0~1). 원천이 없으면 0 */
  getPulse: () => number
}

/** 맥박이 없을 때의 파형. 오브는 두근거리지 않고 파형은 평평하다. */
export const NO_PULSE = (): number => 0

const NO_SOURCE: HeartRateSource = { bpm: null, getPulse: NO_PULSE }

/** 측정 화면의 심박 원천. rPPG 연결 전이라 항상 "값 없음"을 돌려준다. */
export function useHeartRateSource(): HeartRateSource {
  return NO_SOURCE
}

/** bpm 을 화면 글자로. 값이 없으면 "--" */
export function bpmText(bpm: number | null): string {
  return bpm === null ? '--' : String(Math.round(bpm))
}
