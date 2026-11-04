import { readFile, writeFile } from 'node:fs/promises'
import { assess } from './protected-calibration.mjs'

const input = process.argv[2]
if (!input) throw new Error('3차 평가 JSON 경로를 지정하세요')
const r = JSON.parse(await readFile(input, 'utf8'))
const pct = (value) => value === null ? '해당 없음' : `${(value * 100).toFixed(2)}%`
const pp = (value) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%p`
const yes = (value) => value === null ? '미적용(6명 미만)' : value ? '통과' : '실패'
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}\n`
const names = { legacy: '1차 후보 학습 선택', logistic: '2차 다항 로지스틱', bias: '2차 클래스 바이어스',
  'mix-0.25': '혼합 λ=0.25', 'mix-0.5': '혼합 λ=0.5', 'mix-0.75': '혼합 λ=0.75', guard: 'neutral 우선 규칙',
  'weighted-1.5': '가중 로지스틱 1.5', 'weighted-2': '가중 로지스틱 2', 'weighted-3': '가중 로지스틱 3' }
const actors = [...new Set(r.inventory.videos.map((v) => v.actor))].sort()
const legacyFolds = r.legacy.folds.map((f) => ({ ...f, baseline: f.baseline.central, tuned: f.tuned.central }))
const entries = [['legacy', { ...r.legacy, folds: legacyFolds, ...assess(legacyFolds, r.legacy.delta, actors.length) }], ...Object.entries(r.candidates)]
const accepted = entries.filter(([, v]) => v.evidenceSupportsChange)
const missingActors = Array.from({ length: 8 }, (_, i) => String(i + 1).padStart(2, '0')).filter((actor) => !actors.includes(actor))
const rejectionDetails = entries.filter(([, v]) => !v.evidenceSupportsChange).map(([id, v]) => {
  const regressions = v.folds.flatMap((f) => ['frameAccuracy', 'neutralRecall', 'calmRecall']
    .filter((key) => f.tuned[key] + 1e-12 < f.baseline[key])
    .map((key) => `배우 ${f.actor} ${key} ${pp(f.tuned[key] - f.baseline[key])}`))
  return `${names[id]}: 합산 ${pp(v.delta)}${v.delta < 0.02 ? '로 +2%p 미달' : ''}${regressions.length ? `; ${regressions.join(', ')}` : '; 배우별 비감소 충족'}.`
}).join('\n\n')
let report = `## 3차 평가: 무표정을 지키는 보정 (2026-11-04)\n\n`
report += `평가 배우는 **${actors.join('·')} (${actors.length}명)**, 중복 모달리티를 제거한 음성 영상 **${r.inventory.videos.length}개**다. 종료 전 원본 목록·크기를 다시 검사한 추론 실행을 사용했다. 최대 8명 중 이번에 포함되지 않은 배우: ${missingActors.join('·') || '없음'}. ZIP은 직접 풀거나 수정하지 않았다. 최종 실행은 캐시 ${r.cacheStats.reused}개 재사용·${r.cacheStats.inferred}개 신규 추론이다. MM=02 우선, 250ms 간격, 기본 정답 매핑(EE=01·02→calm)은 이전과 같다.\n\n`
report += `### 범위와 학습·선택 방법\n\n현재 브랜치에서 분석 도구·알고리즘 테스트·이 보고서만 수정했다. 공동 설정 파일, 카메라·UI 파일, 공개 타입·호출 계약 변경은 없다. 커밋·push는 하지 않았다.\n\n모든 결과는 배우 전체를 보류하는 교차검증이다. 가운데 60%의 raw가 있는 학습 프레임으로만 계수를 학습하고, EMA α=0.4와 연속 미검출 3회 초기화를 영상 시작부터 재생했다. 평가는 가운데 60%를 주 지표로 삼고 전체 구간도 함께 기록한다. 보류 프레임을 학습이나 임계값 선택에 사용하지 않는다. λ 세 값과 가중치 세 값은 지시된 고정 후보로 각각 별도 평가했다. 이 후보들 사이에서 보류 배우에 맞춰 값을 선택하지 않았다.\n\n기존 정규화는 happy, neutral, sad, angry+disgusted의 합으로 나눈 확률이다. 혼합은 이 확률과 7개 raw 입력의 로지스틱 확률을 혼합한다. neutral 우선 규칙도 정규화 단계에서 적용한다. 기존 정규화의 우세 감정이 calm이고 calm 확률이 τ 이상이면 기존 확률 전체를 보존하고, 그 외에는 로지스틱 확률을 사용한 뒤 동일 EMA를 적용한다. 최종 EMA 판정을 직접 덮어쓰는 규칙은 아니다. τ 후보는 **0, 0.25, 0.5, 0.6, 0.7, 0.8, 0.9, 1**로 사전에 고정했다. 각 외부 학습 집합에서 다시 배우별 내부 교차검증하여 모든 내부 배우의 정확도·neutral·calm 비감소 후보를 우선하고, 그중 정확도가 가장 높은 값을 선택한다. 안전 후보가 없으면 최악 neutral 변화, 최악 calm 변화, 정확도 순으로 고르며 동률은 작은 τ를 우선한다. 선택 후 외부 학습 배우 전체로 계수를 다시 학습한다.\n\n가중 학습은 EE=01 neutral과 EE=02 calm 표본 모두에 1.5·2·3의 가중치를 주며, 가중치 합으로 교차 엔트로피를 정규화한다. 기존 1,000단계·학습률 0.3·L2=0.01은 고정했다.\n\n`
report += `### 후보별 교차검증과 채택 기준\n\n원래 기준은 가운데 60% 합산 정확도 +2%p 이상이면서 **모든 보류 배우의 정확도·neutral·calm 재현율 비감소**다. 완화 기준도 +2%p 조건을 유지하며 모든 배우의 neutral 비감소, 정확도·calm 감소 폭 각각 2%p 이내다. 완화 기준은 배우가 6명 이상일 때만 산출하며, 채택은 원래 기준으로만 판단한다.\n\n`
report += table(['후보', '가운데 정확도', '개선', '전체 정확도', 'neutral 재현율', 'calm 재현율', '원래 배우 조건', '원래 기준', '완화 기준'],
  [['기존', pct(r.baseline.central.frameAccuracy), '기준', pct(r.baseline.all.frameAccuracy), pct(r.baseline.central.neutralRecall), pct(r.baseline.central.calmRecall), '기준', '기준', '기준'],
    ...entries.map(([id, v]) => [names[id], pct(v.tuned.central.frameAccuracy), pp(v.delta), pct(v.tuned.all.frameAccuracy), pct(v.tuned.central.neutralRecall), pct(v.tuned.central.calmRecall), yes(v.consistent), yes(v.evidenceSupportsChange), yes(v.relaxedSupportsChange)])])
report += `\n### 배우별 보류 결과\n\n아래 모든 수치는 가운데 60%다. neutral은 EE=01, calm은 EE=02의 개별 재현율이다. 정확도와 재현율의 분모·정답수, 전체 구간, 혼동행렬, 감정별 지표·영상 다수결, 각 fold 계수·내부 선택 이력은 결과 JSON에 보존했다.\n\n`
report += table(['배우', '선택 영상', '정답 프레임', '기존 정확도', '기존 neutral', '기존 calm'], actors.map((actor) => {
  const b = r.baseline.byActor[actor].central
  return [actor, r.inventory.videos.filter((v) => v.actor === actor).length, b.scored, pct(b.frameAccuracy), pct(b.neutralRecall), pct(b.calmRecall)]
}))
for (const [id, v] of entries) {
  report += `\n#### ${names[id]}\n\n`
  report += table(['보류 배우', '정확도', '정확도 변화', 'neutral', 'neutral 변화', 'calm', 'calm 변화', '학습 선택값'], v.folds.map((f) => [f.actor, pct(f.tuned.frameAccuracy), pp(f.tuned.frameAccuracy - f.baseline.frameAccuracy), pct(f.tuned.neutralRecall), pp(f.tuned.neutralRecall - f.baseline.neutralRecall), pct(f.tuned.calmRecall), pp(f.tuned.calmRecall - f.baseline.calmRecall), f.selection ? `τ=${f.selection.threshold}` : f.selected?.id ?? '고정 후보']))
}
report += `\n### 3차 판단과 한계\n\n${accepted.length ? `원래 기준 통과: ${accepted.map(([id]) => names[id]).join(', ')}.` : `**채택 없음.** 모든 후보가 원래 기준에 미달했다.\n\n${rejectionDetails}`}\n\n따라서 \`features/algorithm/emotion/\`에는 보정을 반영하지 않았고 \`normalizeExpressions\` 시그니처와 \`EmotionResult\`는 그대로다. 7개 raw 입력을 사용하는 이 보정을 향후 채택하려면 현재 5개 입력만 보장하는 공개 계약과의 연결을 별도 검토해야 한다. 이번에는 호출부를 변경하지 않았다. ${actors.length < 6 ? `배우 ${actors.length}명뿐이므로 완화 기준 결과를 추정하지 않는다.` : '완화 기준은 참고용이며 채택에는 사용하지 않는다.'} 연기된 neutral/calm에서의 결과이며 실제 휴식 얼굴의 성능을 보장하지 않는다.\n\n### 재현과 검사\n\n최종 추론 입력: \`${r.input}\`. 상세 결과: \`${input}\`. 분석 소스 SHA-256은 상세 JSON의 analysisHashes에 저장했다.\n\n\`\`\`powershell\nnode scripts/analysis/emotion-ravdess/run.mjs '<RAVDESS 루트>'\nnode scripts/analysis/emotion-ravdess/round3.mjs '.eval/summary-<시각>.json'\nnode scripts/analysis/emotion-ravdess/round3-report.mjs '.eval/round3-<시각>.json'\nnpx.cmd tsc --noEmit\ngit diff --check\nnpx.cmd vitest run tests/algorithm\n\`\`\`\n\n검사 결과는 아래 최종 기록에 기재한다.\n`
const destination = 'docs/analysis/EMOTION_RAVDESS_EVAL.md'
const previous = await readFile(destination, 'utf8')
await writeFile(destination, previous.split('\n## 3차 평가:')[0].trimEnd() + '\n\n' + report)
console.log(`3차 보고서 갱신: ${destination}`)
