export const LABELS = ['happy', 'calm', 'sad', 'angry']
/** @type {Record<number, string | undefined>} 기본 정답 매핑이며 undefined는 정답 평가에서 제외한다. */
export const TARGET = { 1: 'calm', 2: 'calm', 3: 'happy', 4: 'sad', 5: 'angry', 7: 'angry' }
const dominant = (values) => LABELS.reduce((best, key) => values[key] > values[best] ? key : best)
const ratio = (a, b) => b ? a / b : null
const matrix = () => Object.fromEntries(LABELS.map((key) => [key, Object.fromEntries([...LABELS, 'missing'].map((p) => [p, 0]))]))

/** @typedef {{ id: string, alpha: number, window: number, weights: Record<string, number>, fearTo?: string, surpriseTo?: string }} Candidate */

/** @param {Candidate | null} candidate 평가 후보이며 null은 앱의 저장된 판정을 쓴다. */
export function replay(video, candidate = null) {
  if (!candidate) return video.frames.map((frame) => ({ ...frame, prediction: frame.dominant }))
  let ema = null
  let misses = 0
  let window = []
  return video.frames.map((frame) => {
    if (frame.raw) {
      misses = 0
      const r = frame.raw
      const scores = { happy: r.happy, calm: r.neutral, sad: r.sad, angry: r.angry + r.disgusted }
      if (candidate.fearTo) scores[candidate.fearTo] += r.fearful
      if (candidate.surpriseTo) scores[candidate.surpriseTo] += r.surprised
      for (const key of LABELS) scores[key] *= candidate.weights[key]
      const sum = Object.values(scores).reduce((a, b) => a + b, 0)
      const normalized = candidate.calibrate ? candidate.calibrate(r) : sum > 0 ? Object.fromEntries(LABELS.map((key) => [key, scores[key] / sum])) : { happy: 0, calm: 1, sad: 0, angry: 0 }
      ema = ema ? Object.fromEntries(LABELS.map((key) => [key, ema[key] + candidate.alpha * (normalized[key] - ema[key])])) : normalized
      window.push(dominant(ema))
      window = window.slice(-candidate.window)
    } else if (++misses >= 3) { ema = null; window = [] }
    const counts = Object.fromEntries(LABELS.map((key) => [key, window.filter((p) => p === key).length]))
    return { ...frame, prediction: ema ? dominant(counts) : null }
  })
}

/** @param {Candidate | null} candidate 평가 후보 */
export function metrics(videos, candidate = null, central = true, targets = TARGET) {
  const confusion = matrix()
  const source = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((s) => [s, { frames: 0, correct: 0, predictions: Object.fromEntries([...LABELS, 'missing'].map((key) => [key, 0])) }]))
  let frames = 0, detected = 0, expressions = 0, scored = 0, correct = 0, conditionalCorrect = 0, predicted = 0, videoCorrect = 0, videoCount = 0
  for (const video of videos) {
    const votes = Object.fromEntries(LABELS.map((key) => [key, 0]))
    const target = targets[video.source]
    let eligible = 0
    for (const frame of replay(video, candidate)) {
      if (central && !(frame.t >= frame.duration * 0.2 && frame.t < frame.duration * 0.8)) continue
      eligible++
      frames++
      detected += Number(frame.faceDetected)
      expressions += Number(Boolean(frame.raw))
      const p = frame.prediction ?? 'missing'
      source[video.source].frames++
      source[video.source].predictions[p]++
      if (target) {
        scored++
        confusion[target][p]++
        if (p !== 'missing') { predicted++; votes[p]++ }
        if (target === p) { correct++; conditionalCorrect++; source[video.source].correct++ }
      }
    }
    if (target && eligible) {
      videoCount++
      if (Object.values(votes).some(Boolean) && dominant(votes) === target) videoCorrect++
    }
  }
  const byEmotion = Object.fromEntries(LABELS.map((key) => {
    const tp = confusion[key][key]
    const support = Object.values(confusion[key]).reduce((a, b) => a + b, 0)
    const positives = LABELS.reduce((sum, actual) => sum + confusion[actual][key], 0)
    return [key, { support, recall: ratio(tp, support), precision: ratio(tp, positives) }]
  }))
  return { frames, detected, expressions, faceDetectionRate: ratio(detected, frames), expressionRate: ratio(expressions, frames),
    scored, correct, predicted, frameAccuracy: ratio(correct, scored), conditionalAccuracy: ratio(conditionalCorrect, predicted),
    videoCount, videoCorrect, videoAccuracy: ratio(videoCorrect, videoCount), byEmotion, confusion, source,
    neutralRecall: targets[1] ? ratio(source[1].correct, source[1].frames) : null, calmRecall: targets[2] ? ratio(source[2].correct, source[2].frames) : null }
}

/** @param {Candidate | null} candidate 평가 후보 */
export function summarize(videos, candidate = null, targets = TARGET) {
  const group = (field) => Object.fromEntries([...new Set(videos.map((v) => v[field]))].sort().map((value) => [value, {
    central: metrics(videos.filter((v) => v[field] === value), candidate, true, targets), all: metrics(videos.filter((v) => v[field] === value), candidate, false, targets),
  }]))
  return { central: metrics(videos, candidate, true, targets), all: metrics(videos, candidate, false, targets), byActor: group('actor'), byIntensity: group('intensity') }
}

export function candidates() {
  const base = { alpha: 0.4, window: 1, weights: { happy: 1, calm: 1, sad: 1, angry: 1 } }
  const result = [{ ...base, id: 'baseline' }]
  for (const alpha of [0.2, 0.6, 0.8, 1]) result.push({ ...base, alpha, id: `alpha-${alpha}` })
  for (const window of [3, 5, 9]) result.push({ ...base, window, id: `window-${window}` })
  for (const key of LABELS) for (const weight of [0.5, 0.75, 1.5, 2]) {
    result.push({ ...base, weights: { ...base.weights, [key]: weight }, id: `weight-${key}-${weight}` })
  }
  for (const fearTo of LABELS) result.push({ ...base, fearTo, id: `fear-${fearTo}` })
  for (const surpriseTo of LABELS) result.push({ ...base, surpriseTo, id: `surprise-${surpriseTo}` })
  return result
}

// 후보는 사전에 고정한다. 보류 배우의 정답은 후보 선택에 절대로 쓰지 않는다.
export function crossValidate(videos) {
  const actors = [...new Set(videos.map((v) => v.actor))].sort()
  if (actors.length < 2) return { status: 'insufficient-actors', actors, reason: '최소 2명의 배우가 있어야 평가와 튜닝을 분리할 수 있습니다' }
  const folds = []
  const heldout = []
  for (const actor of actors) {
    const training = videos.filter((v) => v.actor !== actor)
    const test = videos.filter((v) => v.actor === actor)
    const baseline = metrics(training)
    let selected = candidates()[0]
    let best = baseline.frameAccuracy
    const trials = []
    for (const candidate of candidates()) {
      const score = metrics(training, candidate)
      const safe = baseline.neutralRecall !== null && baseline.calmRecall !== null && score.neutralRecall >= baseline.neutralRecall && score.calmRecall >= baseline.calmRecall
      trials.push({ id: candidate.id, frameAccuracy: score.frameAccuracy, neutralRecall: score.neutralRecall, calmRecall: score.calmRecall, safe })
      if (safe && score.frameAccuracy > best + 1e-12) { selected = candidate; best = score.frameAccuracy }
    }
    const transformed = test.map((video) => ({ ...video, frames: replay(video, selected).map((frame) => ({ ...frame, dominant: frame.prediction })) }))
    heldout.push(...transformed)
    folds.push({ actor, trainingActors: actors.filter((a) => a !== actor), selected, trainingTrials: trials,
      baseline: summarize(test), tuned: summarize(transformed) })
  }
  const baseline = summarize(videos)
  const tuned = summarize(heldout)
  const delta = tuned.central.frameAccuracy - baseline.central.frameAccuracy
  const safe = tuned.central.neutralRecall >= baseline.central.neutralRecall && tuned.central.calmRecall >= baseline.central.calmRecall
  const consistent = folds.every((f) => f.tuned.central.frameAccuracy >= f.baseline.central.frameAccuracy &&
    f.tuned.central.neutralRecall >= f.baseline.central.neutralRecall && f.tuned.central.calmRecall >= f.baseline.central.calmRecall)
  return { status: 'evaluated', actors, candidateCount: candidates().length, folds, baseline, tuned, delta,
    evidenceSupportsChange: delta >= 0.02 && safe && consistent,
    rule: '가운데 60% 프레임 정확도 +2%p 이상, 모든 보류 배우 정확도·neutral·calm 재현율 비감소. 통과해도 최종 고정 후보는 별도 확인 필요' }
}
