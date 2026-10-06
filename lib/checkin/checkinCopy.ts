import type { StressLevel, BaselineMode } from '../stress/baseline'

const RELATIVE: Record<StressLevel, string> = {
  low: '오늘은 평소보다 마음이 가벼워 보여요 🌿',
  typical: '평소와 비슷하게 흘러가고 있어요',
  high: '평소보다 마음에 힘이 좀 들어가 있네요',
  veryHigh: '평소보다 많이 무거운 하루네요. 천천히 가요',
}

const ABSOLUTE: Record<StressLevel, string> = {
  low: '마음이 잔잔해요 🌿',
  typical: '지금은 무던하게 흘러가요',
  high: '마음에 힘이 좀 들어가 있네요',
  veryHigh: '오늘 좀 무거웠죠. 잠깐 숨 돌릴까요?',
}

/** 비단정·토스 톤 체크인 한 줄. 기준선 모드에 따라 '평소 대비' 여부가 달라진다. */
export function checkinLine(level: StressLevel, mode: BaselineMode): string {
  return mode === 'relative' ? RELATIVE[level] : ABSOLUTE[level]
}
