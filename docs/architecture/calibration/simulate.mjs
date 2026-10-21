// CALIBRATION_DESIGN.md 3.2·3.3절 표를 다시 만드는 탐색용 시뮬레이션.
// 실행: node docs/architecture/calibration/simulate.mjs
// 판정 규칙은 features/algorithm/baseline/baseline.ts와 같은 상수를 그대로 옮겼다.
// CI 검증은 tests/algorithm/baseline/calibrationSimulation.test.ts가 실제 함수로 한다.

const REL_LOW = 0.8, REL_HIGH = 1.25, REL_VH = 1.6, FLOOR = 20
const BASELINES = [8, 15, 25, 40, 60]
const REPEATS = 20 // 모델마다 5 × 5 × 20 = 500명
const DAYS = 30, SLOTS = 2, LATE_FROM_DAY = 14, NOISE_SIGMA = 0.3

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v))
/** floorValue: "20점 이상" 조건을 어느 값에 적용할지 */
function level(value, base, floorValue = value) {
  const r = value / base
  if (r >= REL_VH && floorValue >= FLOOR) return 3
  if (r >= REL_HIGH && floorValue >= FLOOR) return 2
  if (r < REL_LOW) return 0
  return 1
}

function makeRandom(seed) {
  let s = seed
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
  const gauss = () => { const u = rnd() || 1e-9; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) }
  return { rnd, gauss }
}

/** 보여 줄 판정. o는 보정값(점수, -max~+max) */
const SHOWN = {
  none: (n, b) => level(n, b),
  points: (n, b, o) => level(clamp(n + o), b),
  ratio: (n, b, o) => level(n * (1 + o / 50), b, n), // 곱셈형 비율 보정 (N/B)×(1+c), 바닥 조건은 원래 측정값
  ratioAdd: (n, b, o) => level(n + (o / 50) * b, b, n), // 덧셈형 비율 보정 N/B + c, 바닥 조건은 원래 측정값
  ratioAdjFloor: (n, b, o) => { const v = clamp(n * (1 + o / 50)); return level(v, b) },
  hybrid: (n, b, o) => level(clamp(n * (1 + o / 50) + o / 2), b),
}

function nextOffset(o, report, { step, max, decay }) {
  if (report === 'worse') return clamp(o + step, -max, max)
  if (report === 'better') return clamp(o - step, -max, max)
  if (decay) { if (o > 0) return o - 1; if (o < 0) return o + 1 }
  return o
}

/**
 * 체감 판정. ratio: 측정 × (1 + 어긋남), points: 측정 + 어긋남 × 50.
 * CI 테스트와 같게, 체감값 자체에 classifyStress와 같은 규칙(바닥 조건 포함)을 적용한다.
 */
function felt(n, b, model, bias) {
  return model === 'ratio' ? level(clamp(n * (1 + bias)), b) : level(clamp(n + bias * 50), b)
}

function simulate({ shown, decay = false, step = 3, max = 15 }, model, { biases, noise, nonresp }) {
  let agree = 0, severe = 0, total = 0, early = 0, earlyTotal = 0
  for (const B of BASELINES) for (const bias of biases) for (let rep = 0; rep < REPEATS; rep++) {
    const { rnd, gauss } = makeRandom(B * 1000 + Math.round(bias * 100) + rep * 7 + (model === 'ratio' ? 2 : 3))
    let o = 0
    for (let day = 0; day < DAYS; day++) for (let slot = 0; slot < SLOTS; slot++) {
      const n = clamp(B * Math.exp(NOISE_SIGMA * gauss()))
      const s = SHOWN[shown](n, B, o), f = felt(n, B, model, bias)
      if (day >= LATE_FROM_DAY) { total++; if (s === f) agree++; if (Math.abs(s - f) >= 2) severe++ }
      if (day < 7) { earlyTotal++; if (s === f) early++ }
      if (rnd() < nonresp) continue
      let r = s < f ? 'worse' : s > f ? 'better' : 'agree'
      if (rnd() < noise) r = ['worse', 'better', 'agree'][Math.floor(rnd() * 3)]
      if (shown !== 'none') o = nextOffset(o, r, { step, max, decay })
    }
  }
  return { agree: agree / total, severe: severe / total, early: early / earlyTotal }
}

const pct = (x) => (x * 100).toFixed(1).padStart(5)
const BIAS_30 = [-0.3, -0.15, 0, 0.15, 0.3]
const BIAS_45 = [-0.45, -0.3, 0, 0.3, 0.45]

console.log('## 3.2 방식 비교')
for (const cond of [{ noise: 0.15, nonresp: 0.4 }, { noise: 0.3, nonresp: 0.7 }]) {
  console.log(`\n잡음 ${cond.noise}, 미응답 ${cond.nonresp}`)
  console.log('방식                          | 비율 일치 | 점수 일치 | 2단계↑ 최대')
  const methods = [
    ['보정 없음', { shown: 'none' }],
    ['이전 규칙 (점수, 감쇠)', { shown: 'points', decay: true }],
    ['현재 규칙 (점수, 유지)', { shown: 'points' }],
    ['곱셈형 비율 + 감쇠', { shown: 'ratio', decay: true }],
    ['곱셈형 비율 + 유지', { shown: 'ratio' }],
    ['덧셈형 비율 + 유지', { shown: 'ratioAdd' }],
    ['곱셈형 비율 + 유지 + 보정값 바닥', { shown: 'ratioAdjFloor' }],
    ['비율·점수 혼합 + 유지', { shown: 'hybrid' }],
  ]
  for (const [name, m] of methods) {
    const a = simulate(m, 'ratio', { ...cond, biases: BIAS_30 })
    const b = simulate(m, 'points', { ...cond, biases: BIAS_30 })
    console.log(`${name.padEnd(30)} | ${pct(a.agree)} | ${pct(b.agree)} | ${pct(Math.max(a.severe, b.severe))}`)
  }
}

console.log('\n## 3.3 단계·상한 민감도 (현재 규칙, 잡음 0.15, 미응답 0.4)')
console.log('단계/상한 | ±30% 낮은 쪽 | ±45% 낮은 쪽 | 2단계↑ 최대 | 1주차 낮은 쪽(±30%)')
for (const [step, max] of [[2, 10], [3, 15], [3, 21], [5, 15], [5, 25]]) {
  const cond = { noise: 0.15, nonresp: 0.4 }
  const r30 = ['ratio', 'points'].map((m) => simulate({ shown: 'points', step, max }, m, { ...cond, biases: BIAS_30 }))
  const r45 = ['ratio', 'points'].map((m) => simulate({ shown: 'points', step, max }, m, { ...cond, biases: BIAS_45 }))
  const all = [...r30, ...r45]
  console.log(`${`${step}/${max}`.padEnd(9)} | ${pct(Math.min(...r30.map((r) => r.agree)))} | ${pct(Math.min(...r45.map((r) => r.agree)))} | ${pct(Math.max(...all.map((r) => r.severe)))} | ${pct(Math.min(...r30.map((r) => r.early)))}`)
}
