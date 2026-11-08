/** 처음 설문(개인화)을 마쳤는지. 옛 측정 화면(app/measure)과 같은 키를 쓴다. */
export const ONBOARDED_KEY = 'onmaum_onboarded'

/** 설문을 마쳤으면 true. 저장소를 읽을 수 없으면 설문을 다시 묻지 않도록 true 로 본다(옛 측정 화면과 같은 규칙). */
export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true'
  } catch {
    return true
  }
}

/** 설문을 마쳤다고 기록한다. 저장에 실패해도 측정은 막지 않는다. */
export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'true')
  } catch (err) {
    console.error('localStorage 쓰기 실패:', err)
  }
}

/** 마친 처음 설문의 버전. 옛 설문(onmaum_onboarded 만 있음)을 마친 사람에게도 새 설문을 한 번 보이기 위해 따로 둔다 */
export const SURVEY_VERSION_KEY = 'onmaum_survey_version'
/** 2026-11 설문(먹거리·자리에서·마음·퇴근 후·여유·호흡·말투·상태 확인 + 저장·알림) */
export const CURRENT_SURVEY_VERSION = 2

/** 지금 설문을 마쳤다고 기록한다(옛 키도 함께 남긴다). 저장에 실패해도 측정은 막지 않는다 */
export function markSurveyDone(): void {
  markOnboarded()
  try {
    localStorage.setItem(SURVEY_VERSION_KEY, String(CURRENT_SURVEY_VERSION))
  } catch (err) {
    console.error('localStorage 쓰기 실패:', err)
  }
}

/**
 * 측정을 시작할 때 처음 설문을 거쳐야 하는지. 지금 버전 설문을 마친 적이 없으면 true.
 * 옛 설문만 마친 사람, 측정 화면에서 저장 여부만 고른 사람에게도 새 설문을 보인다.
 * "설문 없이 바로 측정"은 이번 한 번만 건너뛰는 길이라 설문을 마칠 때까지 다음 시작에서 다시 보인다.
 * 저장소를 읽을 수 없으면 설문을 반복해 묻지 않도록 false.
 */
export function needsSurvey(): boolean {
  try {
    return localStorage.getItem(SURVEY_VERSION_KEY) !== String(CURRENT_SURVEY_VERSION)
  } catch {
    return false
  }
}
