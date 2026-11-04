import { LABELS, TARGET, candidates, metrics, replay, summarize } from './metrics.mjs'

export const RAW_LABELS = ['happy', 'neutral', 'sad', 'angry', 'disgusted', 'fearful', 'surprised']
export const NEUTRAL_ONLY = { ...TARGET, 2: undefined }
export const TRAINING = { steps: 1000, learningRate: 0.3, l2: 0.01, epsilon: 1e-7 }
const softmax = (values) => {
  const maximum = Math.max(...values)
  const exp = values.map((value) => Math.exp(value - maximum))
  const sum = exp.reduce((a, b) => a + b, 0)
  return exp.map((value) => value / sum)
}
const offset = (raw) => {
  const scores = [raw.happy, raw.neutral, raw.sad, raw.angry + raw.disgusted]
  const sum = scores.reduce((a, b) => a + b, 0)
  const probabilities = sum > 0 ? scores.map((value) => value / sum) : [0, 1, 0, 0]
  return probabilities.map((value) => Math.log(Math.max(TRAINING.epsilon, value)))
}

/** 학습 배우의 가운데 60%에서 raw가 있는 정답 프레임만 사용한다. 설정은 보류 평가 전에 고정한다. */
export function fitCalibration(videos, kind, targets = TARGET, calmWeight = 1) {
  if (!['logistic', 'bias'].includes(kind)) throw new Error('지원하지 않는 보정 후보입니다')
  const samples = videos.flatMap((video) => {
    const target = LABELS.indexOf(targets[video.source])
    if (target < 0) return []
    return video.frames.filter((f) => f.raw && f.t >= f.duration * 0.2 && f.t < f.duration * 0.8)
      .map((f) => ({ x: RAW_LABELS.map((key) => f.raw[key]), offset: offset(f.raw), y: target, weight: target === 1 ? calmWeight : 1 }))
  })
  if (!samples.length) throw new Error('보정 학습에 쓸 정답 프레임이 없습니다')
  const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0)
  const weights = LABELS.map(() => RAW_LABELS.map(() => 0))
  const bias = LABELS.map(() => 0)
  const logits = (sample) => bias.map((b, c) => b + (kind === 'bias' ? sample.offset[c] : weights[c].reduce((s, w, j) => s + w * sample.x[j], 0)))
  // 평균 교차 엔트로피 + L2/2 × 가중치 제곱합. 절편은 규제하지 않는다.
  for (let step = 0; step < TRAINING.steps; step++) {
    const dw = weights.map((row) => row.map(() => 0))
    const db = bias.map(() => 0)
    for (const sample of samples) {
      const probabilities = softmax(logits(sample))
      for (let c = 0; c < LABELS.length; c++) {
        const error = (probabilities[c] - Number(c === sample.y)) * sample.weight
        db[c] += error
        if (kind === 'logistic') for (let j = 0; j < RAW_LABELS.length; j++) dw[c][j] += error * sample.x[j]
      }
    }
    for (let c = 0; c < LABELS.length; c++) {
      bias[c] -= TRAINING.learningRate * db[c] / totalWeight
      if (kind === 'logistic') for (let j = 0; j < RAW_LABELS.length; j++) {
        weights[c][j] -= TRAINING.learningRate * (dw[c][j] / totalWeight + TRAINING.l2 * weights[c][j])
      }
    }
  }
  const loss = -samples.reduce((sum, sample) => sum + sample.weight * Math.log(Math.max(TRAINING.epsilon, softmax(logits(sample))[sample.y])), 0) / totalWeight
  return { kind, weights, bias, samples: samples.length, calmWeight, loss, trainingActors: [...new Set(videos.map((v) => v.actor))].sort(), settings: TRAINING }
}

export function calibrationCandidate(model) {
  return { ...candidates()[0], id: model.kind, calibrate: (raw) => {
    const x = RAW_LABELS.map((key) => raw[key])
    const base = offset(raw)
    const probabilities = softmax(model.bias.map((b, c) => b + (model.kind === 'bias' ? base[c] : model.weights[c].reduce((s, w, j) => s + w * x[j], 0))))
    return Object.fromEntries(LABELS.map((key, i) => [key, probabilities[i]]))
  } }
}

/** 한 배우 전체를 보류한다. 보류 배우는 학습·설정 선택에 사용하지 않는다. */
export function validateCalibration(videos, kind, targets = TARGET) {
  const actors = [...new Set(videos.map((v) => v.actor))].sort()
  if (actors.length < 2) return { status: 'insufficient-actors', actors }
  const heldout = []
  const folds = actors.map((actor) => {
    const training = videos.filter((v) => v.actor !== actor)
    const test = videos.filter((v) => v.actor === actor)
    const model = fitCalibration(training, kind, targets)
    const candidate = calibrationCandidate(model)
    const transformed = test.map((v) => ({ ...v, frames: replay(v, candidate).map((f) => ({ ...f, dominant: f.prediction })) }))
    heldout.push(...transformed)
    return { actor, model, baseline: metrics(test, null, true, targets), tuned: metrics(transformed, null, true, targets) }
  })
  const baseline = summarize(videos, null, targets)
  const tuned = summarize(heldout, null, targets)
  const delta = tuned.central.frameAccuracy - baseline.central.frameAccuracy
  // 민감도 매핑에서는 EE=02에 정답이 없으므로 해당 재현율을 채택 근거로 쓰지 않는다.
  const keys = targets[2] ? ['frameAccuracy', 'neutralRecall', 'calmRecall'] : ['frameAccuracy', 'neutralRecall']
  const consistent = folds.every((fold) => keys.every((key) => fold.tuned[key] !== null && fold.tuned[key] + 1e-12 >= fold.baseline[key]))
  return { status: 'evaluated', kind, actors, folds, baseline, tuned, delta, consistent,
    evidenceSupportsChange: Boolean(targets[2]) && delta >= 0.02 && consistent }
}
