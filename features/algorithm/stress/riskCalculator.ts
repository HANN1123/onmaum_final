/**
 * 부정 정서 계산에서 화남에 곱하는 가중치. stressIndex 등에서 재사용.
 * 이전 값 1.5(화남 인식률 보정)는 근거를 확인하지 못해 1.0(가중 없음)으로 되돌렸다.
 * 1.0이면 부정 정서 N이 항상 0~100 범위에 든다.
 * 근거와 검증 계획: docs/architecture/STRESS_INDEX_RATIONALE.md
 */
export const ANGRY_WEIGHT = 1
