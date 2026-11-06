import type { RppgQuality } from '../engine/rppgGate'

/** 시간은 초 단위다. 품질 없는 이전 세션은 good으로 취급한다. */
export interface BpmSample {
  t: number
  bpm: number | null
  quality?: RppgQuality
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export const ONLINE_BPM_OPTIONS = { windowSec: 20, deviation: 8, holdSec: 4, maxRate: 2 }
export const SERIES_BPM_OPTIONS = { windowSec: 5, goodSigma: 4, flaggedSigma: 2.5, floorBpm: 3, gapSec: 0 }

export interface DisplayBpmState {
  history: BpmSample[]
  t: number | null
  bpm: number | null
  heldSince: number | null
}

export function initialDisplayBpmState(): DisplayBpmState {
  return { history: [], t: null, bpm: null, heldSince: null }
}

/**
 * 과거 원래 값만 참조한다. good 기준이 없으면 전체 중앙값·MAD로 대신한다.
 * 20초 기준창·8 BPM 이탈·4초 보류·초당 2 BPM 제한은 MCD 피험자 절반의 후보 비교로 정했다.
 * 보류를 무한 연장하지 않고, 지속되는 실제 변화에도 따라가도록 원래 값은 계속 이력에 넣는다.
 * 평가 방법과 후보별 수치는 .eval/bpm-report.md에 남긴다. 정답이나 미래 표본은 입력받지 않는다.
 */
export function nextDisplayBpm(
  state: DisplayBpmState,
  sample: BpmSample,
  options = ONLINE_BPM_OPTIONS,
): DisplayBpmState {
  if (sample.bpm === null || !Number.isFinite(sample.bpm)) return initialDisplayBpmState()
  if (state.t !== null && (sample.t <= state.t || sample.t - state.t > 2)) state = initialDisplayBpmState()
  const history = state.history.filter((s) => s.t >= sample.t - options.windowSec)
  const good = history.filter((s) => (s.quality ?? 'good') === 'good')
  const values = (good.length ? good : history).map((s) => s.bpm as number)
  const center = values.length ? median(values) : sample.bpm
  const mad = values.length ? median(values.map((v) => Math.abs(v - center))) : 0
  const threshold = good.length ? options.deviation : Math.max(options.deviation, 3 * 1.4826 * mad)
  const outlier = sample.quality !== undefined && sample.quality !== 'good' && Math.abs(sample.bpm - center) > threshold
  const heldSince = outlier ? state.heldSince ?? sample.t : null
  let bpm = sample.bpm
  if (outlier && state.bpm !== null && sample.t - heldSince! < options.holdSec) bpm = state.bpm
  if (state.bpm !== null && state.t !== null) {
    const step = options.maxRate * (sample.t - state.t)
    bpm = Math.max(state.bpm - step, Math.min(state.bpm + step, bpm))
  }
  return { history: [...history, sample], t: sample.t, bpm, heldSince }
}

/**
 * 전후 5초 Hampel 판정. good은 4σ, 참고값은 2.5σ, σ 하한은 3 BPM이다.
 * 참고값은 근처 good이 3개 이상이면 그 기준을 우선한다. 10초 창은 정상적인
 * 8초 상승 구간도 지우므로 제외했다. 나머지 후보는 설정용 피험자 MAE로 선택했다.
 * 제거한 자리는 기본적으로 null로 둔다. 3초 보간은 설정용 오차가 늘어 채택하지 않았다.
 * gapSec을 지정하면 제거된 짧은 구간만 보간한다. 원래 결측과 양 끝은 보완하지 않는다.
 */
export function cleanBpmSeries<T extends BpmSample>(samples: readonly T[], options = SERIES_BPM_OPTIONS): T[] {
  const result = samples.map((sample) => {
    if (sample.bpm === null) return { ...sample }
    if (!Number.isFinite(sample.bpm)) return { ...sample, bpm: null }
    const nearby = samples.filter((s) => Math.abs(s.t - sample.t) <= options.windowSec && s.bpm !== null && Number.isFinite(s.bpm))
    const flagged = (sample.quality ?? 'good') !== 'good'
    const good = nearby.filter((s) => (s.quality ?? 'good') === 'good')
    const values = (flagged && good.length >= 3 ? good : nearby).map((s) => s.bpm as number)
    const center = median(values)
    const sigma = Math.max(options.floorBpm, 1.4826 * median(values.map((v) => Math.abs(v - center))))
    const limit = (flagged ? options.flaggedSigma : options.goodSigma) * sigma
    return { ...sample, bpm: Math.abs(sample.bpm - center) > limit ? null : sample.bpm }
  })
  if (options.gapSec <= 0) return result
  for (let i = 0; i < result.length; i++) {
    if (result[i].bpm !== null) continue
    const start = i
    while (i < result.length && result[i].bpm === null) i++
    const left = result[start - 1]
    const right = result[i]
    const removed = samples.slice(start, i).every((s) => s.bpm !== null && Number.isFinite(s.bpm))
    if (!left || !right || !removed || right.t - left.t > options.gapSec + 1) continue
    for (let k = start; k < i; k++) {
      result[k].bpm = left.bpm! + (right.bpm! - left.bpm!) * (result[k].t - left.t) / (right.t - left.t)
    }
  }
  return result
}
