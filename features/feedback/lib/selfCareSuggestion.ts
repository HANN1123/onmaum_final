import type { Emotion } from '../../algorithm/emotion/emotionAnalysis'
import type { Profile } from '../../../shared/storage/profile'

/** 프로필이 없을 때의 감정별 기본 제안 (토스 톤, 비단정). 표정만으로 기분을 단정하지 않는다. */
const DEFAULT_BY_EMOTION: Record<Emotion, string> = {
  calm: '잠깐 쉬면서 지금 기분이 어떤지 돌아볼까요?',
  happy: '잠깐 쉬어 가며 오늘을 돌아볼까요?',
  sad: '따뜻한 차 한 잔 어떠세요',
  angry: '잠깐 깊게 숨 한 번 쉬어볼까요',
}

/**
 * 온보딩 설문 선택지별 제안 문장.
 * 선택지 이름을 고정 문장에 끼워 넣으면 "좋아하는 글귀 하고 가요"처럼 어색해지므로 문장을 미리 쓴다.
 * 설문 선택지를 바꾸면 여기에도 문장을 추가한다 (tests/ui/onboarding에서 누락 검사).
 */
export const RELIEF_SUGGESTIONS: Record<string, string> = {
  커피: '커피 한 잔 하며 잠깐 쉬어 가요',
  '따뜻한 차': '따뜻한 차 한 잔 어때요?',
  '시원한 물': '시원한 물 한 잔 마셔 볼까요?',
  '달달한 간식': '달달한 간식 하나 어때요?',
  탄산음료: '탄산음료 한 모금 어때요?',
  과일: '과일 조금 먹으며 쉬어 가요',
  '짧은 산책': '잠깐 일어나서 걸어 볼까요?',
  '창밖 보기': '잠깐 창밖을 바라봐요',
  스트레칭: '어깨를 천천히 풀어 볼까요?',
  '기지개 켜기': '기지개 한 번 켜 볼까요?',
  '잠깐 눈 감기': '잠깐 눈을 감고 쉬어 가요',
  '세수·손 씻기': '세수하거나 손을 씻어 볼까요?',
  '천천히 숨쉬기': '천천히 숨을 몇 번 쉬어 볼까요?',
  '짧은 명상': '잠깐 눈을 감고 호흡에 집중해 봐요',
  '좋아하는 사진 보기': '좋아하는 사진 한 장 꺼내 볼까요?',
  '향초·아로마': '좋아하는 향을 맡으며 쉬어 가요',
  '반려동물·식물 보기': '반려동물이나 식물을 잠깐 바라봐요',
  '멍하니 쉬기': '아무것도 하지 않고 잠깐 쉬어 볼까요?',
  '응원의 말': '서두르지 않고 잠깐 쉬어 가도 괜찮아요',
  '좋아하는 글귀': '좋아하는 글귀를 한 번 떠올려 봐요',
  '귀여운 사진': '귀여운 사진 하나 보고 가요',
  '누군가와 대화': '편한 사람과 잠깐 이야기해 볼까요?',
  '따뜻한 샤워': '오늘은 따뜻한 물로 씻고 푹 쉬어요',
  '일찍 잠들기': '오늘은 조금 일찍 쉬어 봐요',
}

/** 이전 설문 선택지 이름 → 현재 이름. 이미 저장된 프로필을 그대로 읽기 위해 둔다. */
const LEGACY_RELIEF_LABELS: Record<string, string> = {
  '커피 한 잔': '커피',
  '탄산 한 모금': '탄산음료',
  '상큼한 과일': '과일',
  '어깨 스트레칭': '스트레칭',
  '박스 호흡': '천천히 숨쉬기',
  '3분 명상': '짧은 명상',
  '잠깐 멍때리기': '멍하니 쉬기',
  '응원 한 마디': '응원의 말',
  '좋아하는 명언': '좋아하는 글귀',
  '귀여운 사진·밈': '귀여운 사진',
  '누군가와 잠깐 수다': '누군가와 대화',
}

/** 저장값이 'toString' 같은 객체 기본 속성 이름이어도 문장으로 잘못 읽지 않게 한다 */
function hasOwn(map: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key)
}

/**
 * 지배 감정 + 로컬 프로필(선호 해소법)로 회복 제안을 만든다.
 * 프로필이 있으면 첫 선호의 문장을 그대로 쓰고(감정으로 하루를 단정하는 앞말은 붙이지 않음),
 * 없으면 감정별 기본 제안.
 */
export function suggestionFor(dominant: Emotion, profile: Profile | null): string {
  if (profile && profile.reliefs.length > 0) {
    const saved = profile.reliefs[0]
    const relief = hasOwn(LEGACY_RELIEF_LABELS, saved) ? LEGACY_RELIEF_LABELS[saved] : saved
    return hasOwn(RELIEF_SUGGESTIONS, relief) ? RELIEF_SUGGESTIONS[relief] : `${relief} 어때요?`
  }
  return DEFAULT_BY_EMOTION[dominant]
}
