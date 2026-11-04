import { calibrationCandidate, fitCalibration } from './calibration.mjs'
import { candidates, LABELS, metrics, replay, summarize } from './metrics.mjs'

export const THRESHOLDS = [0, 0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
const trainingReferences = new WeakMap()
let nextTrainingReference = 0
const trainingReference = (video) => {
  if (!trainingReferences.has(video)) trainingReferences.set(video, ++nextTrainingReference)
  return trainingReferences.get(video)
}
export function baselineProbabilities(raw) {
  const scores = [raw.happy, raw.neutral, raw.sad, raw.angry + raw.disgusted]
  const sum = scores.reduce((a, b) => a + b, 0)
  return Object.fromEntries(LABELS.map((key, i) => [key, sum > 0 ? scores[i] / sum : Number(key === 'calm')]))
}

/** 보정은 정규화 단계에서 수행하고 기존 EMA·미검출 초기화는 그대로 재생한다. */
export function protectedCandidate(model, mode, value) {
  const logistic = calibrationCandidate(model)
  return { ...candidates()[0], id: `${mode}-${value}`, calibrate(raw) {
    const base = baselineProbabilities(raw)
    const tuned = logistic.calibrate(raw)
    if (mode === 'mix') return Object.fromEntries(LABELS.map((key) => [key, (1 - value) * base[key] + value * tuned[key]]))
    if (mode === 'guard') {
      const best = LABELS.reduce((a, b) => base[b] > base[a] ? b : a)
      return best === 'calm' && base.calm >= value ? base : tuned
    }
    return tuned
  } }
}

export function transform(videos, candidate) {
  return videos.map((video) => ({ ...video, frames: replay(video, candidate).map((f) => ({ ...f, dominant: f.prediction })) }))
}

export function assess(folds, delta, actorCount) {
  const valid = (f, key, tolerance) => f.tuned[key] !== null && f.baseline[key] !== null && f.tuned[key] + tolerance + 1e-12 >= f.baseline[key]
  const original = folds.every((f) => ['frameAccuracy', 'neutralRecall', 'calmRecall'].every((key) => valid(f, key, 0)))
  const relaxed = actorCount >= 6 ? folds.every((f) => valid(f, 'neutralRecall', 0) && valid(f, 'calmRecall', 0.02) && valid(f, 'frameAccuracy', 0.02)) : null
  return { delta, consistent: original, relaxedConsistent: relaxed, evidenceSupportsChange: delta + 1e-12 >= 0.02 && original,
    relaxedSupportsChange: relaxed === null ? null : delta + 1e-12 >= 0.02 && relaxed }
}

/** 임계값은 외부 보류 배우를 제외한 학습 배우의 내부 교차검증으로만 선택한다. */
export function selectThreshold(training, modelCache = new Map()) {
  const actors = [...new Set(training.map((v) => v.actor))].sort()
  if (actors.length < 2) throw new Error('임계값 선택에는 최소 두 학습 배우가 필요합니다')
  const inner = actors.map((actor) => {
    const test = training.filter((v) => v.actor === actor)
    const subset = training.filter((v) => v.actor !== actor)
    // 같은 원본 영상 객체 집합의 학습만 재사용한다. 보류 데이터나 다른 실행의 계수는 섞지 않는다.
    const key = subset.map((v) => trainingReference(v)).sort((a, b) => a - b).join(',')
    if (!modelCache.has(key)) modelCache.set(key, fitCalibration(subset, 'logistic'))
    return { actor, test, baseline: metrics(test), model: modelCache.get(key) }
  })
  const trials = THRESHOLDS.map((threshold) => {
    const folds = inner.map(({ actor, test, baseline, model }) => ({ actor, baseline, tuned: metrics(test, protectedCandidate(model, 'guard', threshold)) }))
    const scored = folds.reduce((s, f) => s + f.tuned.scored, 0)
    const accuracy = folds.reduce((s, f) => s + f.tuned.correct, 0) / scored
    const worstNeutral = Math.min(...folds.map((f) => f.tuned.neutralRecall - f.baseline.neutralRecall))
    const worstCalm = Math.min(...folds.map((f) => f.tuned.calmRecall - f.baseline.calmRecall))
    return { threshold, folds, accuracy, worstNeutral, worstCalm, safe: assess(folds, 0, actors.length).consistent }
  })
  // 안전 후보 우선, 없으면 neutral·calm 최악 감소 폭 순, 이어 정확도 순. 동률은 작은 임계값 우선이다.
  const ranked = [...trials].sort((a, b) => Number(b.safe) - Number(a.safe) ||
    (a.safe ? 0 : b.worstNeutral - a.worstNeutral || b.worstCalm - a.worstCalm) || b.accuracy - a.accuracy || a.threshold - b.threshold)
  return { threshold: ranked[0].threshold, trainingActors: actors, trials }
}

export function validateProtected(videos) {
  const actors = [...new Set(videos.map((v) => v.actor))].sort()
  if (actors.length < 3) throw new Error('중첩 배우 교차검증에는 최소 세 배우가 필요합니다')
  const baseline = summarize(videos)
  const definitions = [{ id: 'logistic', mode: 'logistic', value: 1 }, { id: 'bias', mode: 'bias', value: 1 },
    ...[0.25, 0.5, 0.75].map((value) => ({ id: `mix-${value}`, mode: 'mix', value })),
    { id: 'guard', mode: 'guard' }, ...[1.5, 2, 3].map((value) => ({ id: `weighted-${value}`, mode: 'weighted', value }))]
  const results = Object.fromEntries(definitions.map((d) => [d.id, {
    folds: /** @type {Array<{actor: string, model: ReturnType<typeof fitCalibration>, selection: ReturnType<typeof selectThreshold> | undefined, baseline: ReturnType<typeof metrics>, tuned: ReturnType<typeof metrics>}>} */ ([]),
    heldout: /** @type {ReturnType<typeof transform>} */ ([]),
  }]))
  const modelCache = new Map()
  for (const actor of actors) {
    const training = videos.filter((v) => v.actor !== actor)
    const test = videos.filter((v) => v.actor === actor)
    const logistic = fitCalibration(training, 'logistic')
    const selection = selectThreshold(training, modelCache)
    for (const definition of definitions) {
      const { id, mode, value } = definition
      const model = mode === 'bias' ? fitCalibration(training, 'bias') : mode === 'weighted' ? fitCalibration(training, 'logistic', undefined, value) : logistic
      const candidate = mode === 'bias' ? calibrationCandidate(model) : protectedCandidate(model, mode, mode === 'guard' ? selection.threshold : value)
      const transformed = transform(test, candidate)
      results[id].heldout.push(...transformed)
      results[id].folds.push({ actor, model, selection: mode === 'guard' ? selection : undefined, baseline: metrics(test), tuned: metrics(transformed) })
    }
    console.log(`보류 배우 ${actor} 완료, 학습 배우에서 선택한 임계값 ${selection.threshold}`)
  }
  return Object.fromEntries(definitions.map(({ id }) => {
    const { folds, heldout } = results[id]
    const tuned = summarize(heldout)
    return [id, { folds, tuned, ...assess(folds, tuned.central.frameAccuracy - baseline.central.frameAccuracy, actors.length) }]
  }))
}
