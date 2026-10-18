# 표정 감정 분석·스트레스 지수 로직 검토

- 작성: 이정환 (⑤ 감정 및 개인 상태 분석), 2026-10-19
- 기준: `origin/main` (`d570e3f`)
- 범위: `features/algorithm/**`와 그 호출부. **코드는 바꾸지 않았다.** 아래 개선안은 후속 작업에서 별도 PR로 진행한다.
- 근거 문서: [v2 감정 오브·스트레스 지수 설계](../superpowers/specs/2026-06-08-onmaum-v2-orb-stress-design.md)(이하 v2 설계), [스트레스 엔진 구현 계획](../superpowers/plans/2026-06-08-stress-index-engine.md)

## 1. 요약

| # | 분류 | 내용 | 영향 |
|---|---|---|---|
| F1 | 설계-구현 불일치 | v2 설계의 **지속 게이트(부정 3초 이상만 인정)와 EMA가 구현만 되고 연결되지 않았다.** 현재 스트레스 N은 게이트 없는 프레임 평균이다 | 순간적인 찡그림도 N에 그대로 반영 |
| F2 | 계약 불일치 | `StressScores.stress`는 주석상 0~100이지만 **최대 150**까지 나온다 | 기준선 중앙값·표시값 해석 |
| F3 | 설계 확인 필요 | 자기보고 보정값(점수 단위)을 오늘 값에만 더하고 기준선에는 적용하지 않는다 | 상대 모드에서 보정 효과가 기준선 크기에 따라 크게 달라짐 |
| F4 | 정확도 | 레코드 `duration`이 실제 경과 시간보다 짧게 기록될 수 있다 | 유효일 판정(하루 5분) |
| F5 | 검토 | face-api의 `fearful`·`surprised`를 버리고 4감정으로 재정규화한다 | 공포 정서가 다른 감정에 비례 배분됨 |
| F6 | 개선 | `hardestPeriod`에 최소 측정 시간이 없다 | 몇 초짜리 구간이 "가장 힘든 시간대"로 표시될 수 있음 |
| F7 | 경계 사례 | 확률 합이 0이면 `calm = 1`로 처리한다 | 실질 영향 작음 |
| F8 | 정리 | 운영 코드에서 쓰지 않는 함수 6개, 이름이 맞지 않는 파일 1개 | 유지보수 |

잘 되어 있는 점: 계산이 모두 부수효과 없는 순수 함수이고, 7개 테스트 파일 47개 테스트가 함수별 동작을 고정하고 있다. 무표정(`flatAffectScore`)을 스트레스에 넣지 않는다는 v2 원칙("무표정 ≠ 소진")도 지켜지고 있다.

## 2. 현재 계산 흐름

```text
[카메라 ① 김우빈]  face-api expressions (약 0.5초마다)
        │  normalizeExpressions(raw)          ← 경계
        ▼
[감정 ⑤]  EmotionResult {happy, calm, sad, angry} (합 1)
        │  useEmotionRecorder 버퍼 → 1분마다 aggregate()
        ▼
[저장 ③]  EmotionRecord (1분 평균 확률, duration, detectionRate, flatAffectScore)
        │
        ▼
[스트레스 ⑤]  aggregateStress(records)  ← duration 가중 평균
        │   P = 100·Σ(happy·dur)/Σdur
        │   N = 100·Σ((sad + 1.5·angry)·dur)/Σdur
        ├─ dailyStressHistory → computeBaselineState (14일 중 유효일 ≥3이면 중앙값 기준선)
        ├─ recentStress (최근 30분) → useCheckin, useNudge
        └─ applyOffset(N, calibrationOffset) → classifyStress → low/typical/high/veryHigh
```

### 함수별 사용처

| 함수 | 운영 코드 사용처 |
|---|---|
| `normalizeExpressions` | `features/camera/lib/faceDetection.ts` |
| `getDominantEmotion` | `EmotionDisplay`, `EmotionOrb`, `orbColor` |
| `aggregate` | `useEmotionRecorder` |
| `aggregateStress` | `DailyReport` (+ `dailyStress.ts` 내부) |
| `dailyStressHistory`, `computeBaselineState` | `useCheckin`, `useNudge`, `DailyReport`, `TrendChart` |
| `recentStress` | `useCheckin`, `useNudge` |
| `classifyStress`, `applyOffset` | `useCheckin`, `useNudge`, `DailyReport` |
| `hardestPeriod` | `DailyReport` |
| `nextOffset` | `useCheckin` |
| **미사용**: `frameContribution`, `mindBalance`, `affectEnergy`, `gateSustainedNegative`, `emaStress`, `dailyStressFor` | 테스트에서만 사용 |

## 3. 상세 검토

### F1. 지속 게이트·EMA 미연결 (설계-구현 불일치)

- v2 설계 §4: 프레임 단위 `neg_t`에 "부정이 3초 이상 지속될 때만 인정" 게이트를 적용한 뒤 집계하고, "지금값"은 EMA로 부드럽게 한다.
- 구현 계획에서 `gateSustainedNegative`, `emaStress`를 만들고 "UI/녹화 훅 연결은 후속 플랜에서" 하기로 했지만, 이후 연결되지 않았다(사용처 검색 결과 0건).
- 현재 구조: `aggregate()`가 1분 동안의 확률을 **평균해서** 저장하고, `aggregateStress`는 그 평균에 선형 계산을 한다. 따라서 현재 N은 "게이트 없는 프레임별 부정값의 평균"과 같다.
- **게이트는 프레임 정보가 있는 집계 이전 단계, 즉 레코더 버퍼에서만 적용할 수 있다.** 1분 평균이 저장된 뒤에는 되돌릴 수 없다.
- 고려사항:
  - `useEmotionRecorder`는 공동 영역이다. 게이트를 넣으려면 김우빈과 연결 방식을 정해야 한다.
  - 게이트를 적용하면 레코드 의미가 바뀐다. 예를 들어 "게이트 적용 부정 평균" 필드를 추가하면 기존 레코드와 직접 비교할 수 없으므로, 기준선 계산의 전환 규칙이 필요하다. 이는 schema 변경이므로 Dexie v2 작업과 함께 검토한다.
  - EMA는 오브의 "지금값" 표시용이다. 현재 오브는 0.5초 원시 감정값을 쓴다. 적용하면 오브 반응 속도가 바뀌므로 ④ UI와 함께 정한다.

### F2. 스트레스 값이 100을 넘을 수 있음

- `neg = sad + 1.5·angry`이고 `sad + angry ≤ 1`이므로 `angry = 1`이면 `neg = 1.5`, **N = 150**이다.
- `StressScores`의 주석은 `stress: number // 0~100`이다.
- 현재 처리:
  - `applyOffset`이 0~100으로 자르므로 `classifyStress`에 들어가는 오늘 값은 100 이하다.
  - `DailyReport`의 게이지는 표시 폭만 100으로 자르고, 숫자는 원값을 보여 준다.
  - **기준선 중앙값은 자르지 않은 원값**으로 계산된다. 오늘 값(최대 100)과 기준선(최대 150)의 범위가 다르다.
- 화남 비중이 매우 큰 하루에만 생기므로 빈도는 낮다. 선택지는 (a) 주석·계약을 "0~150"으로 고치기, (b) 집계 결과를 0~100으로 자르기, (c) `ANGRY_WEIGHT` 적용 후 재정규화하기다. (b)가 가장 단순하지만 기준선 값이 바뀔 수 있어 테스트 기대값과 화면 값 변경을 공유해야 한다.

### F3. 보정값 적용 위치 (설계 확인 필요)

- 체크인에서 "더 힘들었어요"를 누르면 `calibrationOffset`이 +3점씩, 최대 +15점까지 오른다. 이 값은 **오늘 N에만** 더해지고(`applyOffset`), 기준선은 보정하지 않은 과거 N의 중앙값이다.
- 상대 모드는 비율(`오늘 / 기준선`)로 판정하므로, 같은 보정값이라도 기준선이 낮을수록 효과가 커진다.
  - 기준선 20, 오늘 원값 20, 보정 +15 → 35 / 20 = 1.75 → `veryHigh` (`ABS_FLOOR_N = 20` 이상이므로 바닥 조건 통과)
  - 기준선 40, 오늘 원값 40, 보정 +15 → 55 / 40 = 1.38 → `high`
- "사용자 체감이 측정보다 높다"는 신호를 반영하는 의도라면 타당할 수 있지만, 보정이 최대치에 머물면 평소와 같은 날도 계속 "평소보다 많이 높음"으로 보일 수 있다.
- 결정할 것: 보정을 (a) 지금처럼 오늘 값에만 더할지, (b) 기준선에도 같은 보정을 적용해 상대 판정에는 영향이 없게 할지, (c) 상대 모드에서는 비율 단위로 보정할지. 체크인 문구(⑥)와 함께 결정한다.

### F4. 기록 시간이 실제보다 짧을 수 있음

- 레코더는 분석이 끝난 뒤 `setTimeout(tick, intervalMs)`로 다음 분석을 예약한다. 실제 간격은 "분석 소요 시간 + 500ms"이지만, 각 샘플은 `intervalMs`(500ms)로 기록된다.
- 결과적으로 `duration`과 `detectionRate`의 분모가 실제 경과 시간보다 작다.
  - P·N은 가중 평균이라 **비율이 같아서 영향이 없다.**
  - 하루 유효 측정 판정(`MIN_VALID_DAY_DURATION_MS = 5분`)과 화면에 보이는 측정 시간은 실제보다 짧게 잡힌다.
- 실제 분석 소요 시간은 기기마다 다르므로 먼저 측정이 필요하다. 레코더는 공동 영역이라 수정 시 김우빈과 함께 검토한다.

### F5. `fearful`·`surprised` 제외

- `faceDetection.ts`는 face-api의 `expressions` 객체를 그대로 넘기고, `normalizeExpressions`는 그중 `happy`, `neutral`, `sad`, `angry`, `disgusted`만 읽는다.
- 공포·놀람 확률은 버려지고, 남은 다섯 값으로 다시 정규화되면서 다른 감정에 비례 배분된다. 공포가 큰 프레임에서는 평온·기쁨도 함께 부풀 수 있다.
- v2 설계는 4감정을 택했고 `disgust`만 부정에 합쳤다. `fearful`을 부정 정서로 볼지는 아직 결정된 적이 없다.
- 바꾸면 기존 기록과 비교할 수 없게 되고 테스트 기대값도 바뀐다. 실제 측정 데이터에서 `fearful` 비중을 먼저 확인한 뒤 결정하자고 제안한다. raw 입력 경계(`RawExpressions`)는 공동 계약이므로 필드 추가 시 김우빈과 공유한다.

### F6. `hardestPeriod` 최소 시간 없음

- 2시간 단위 구간 중 N이 가장 큰 구간을 고르는데, 구간 안의 측정 시간 합계를 보지 않는다. 몇 초 동안만 측정된 구간이 "가장 힘든 시간대"로 표시될 수 있다.
- 제안: 구간별 최소 측정 시간(예: 5분)을 두고, 넘는 구간이 없으면 `null`을 반환한다.

### F7. 확률 합이 0인 프레임

- `normalizeExpressions`는 합이 0 이하면 `{ calm: 1 }`을 반환한다. face-api 확률 합은 보통 1에 가까워 실제로는 드물다.
- 생긴다면 감지 실패를 "평온"으로 기록하게 된다. `null`(미감지)로 처리하는 편이 의미상 정확하지만, 반환 타입이 바뀌어 카메라 어댑터에 영향이 있다. 우선순위 낮음.

### F8. 정리 대상

- 미사용 함수 6개는 F1의 연결 여부를 정한 뒤에 처리한다. 연결하면 쓰이고, 쓰지 않기로 하면 그때 삭제를 검토한다. 지금 지우지 않는다.
  - `mindBalance`·`affectEnergy`는 v2 설계의 파생값(마음균형·정서활력)이지만 화면에 쓰이지 않는다.
- `ANGRY_WEIGHT`가 `stress/riskCalculator.ts`에 있다. 이전 "위험도 계산" 단계의 이름이 남은 것이다. 이름 정리는 기능 변경 없이 따로 진행할 수 있다.
- 참고: `RecentRecords`는 `flatAffectScore`를 "평탄 0.xx"로 그대로 보여 준다. 계산에 쓰이지 않는 값이라 원칙 위반은 아니지만, 사용자가 위험 신호로 오해하지 않도록 문구를 검토할 만하다(④ UI 공동 검토 메모).

### 기타 확인 (문제 아님)

- `recentStress`는 오늘 레코드만 받으므로 자정 직후 30분 동안은 창이 짧아진다. 영향이 작아 그대로 둔다.
- `getDominantEmotion`은 동률이면 `EMOTION_ORDER` 앞쪽(기쁨)을 고른다. 테스트로 고정돼 있다.
- 기준선은 오늘을 제외한 과거 14일 중 유효일 3일 이상일 때 중앙값을 쓴다. 이상치에 강한 방식이라 심박 기준선 설계에도 같은 틀을 재사용할 수 있다.

## 4. 후속 작업 제안

| 순서 | 작업 | 담당 | 공유·검토 |
|---|---|---|---|
| 1 | F2 스트레스 범위 계약 정리 (선택지 결정 후 테스트 추가) | 이정환 | 화면 값이 바뀌면 김우빈에게 공유 |
| 2 | F3 보정값 적용 방식 결정 | 이정환 | 체크인 문구(⑥)와 함께 |
| 3 | F6 `hardestPeriod` 최소 측정 시간 | 이정환 | 리포트 표시 변경 → `features/ui/report` 공동 검토 |
| 4 | F4 실제 분석 간격 측정 → `duration` 보정 여부 결정 | 공동 | 레코더 공동 영역 |
| 5 | F1 지속 게이트·EMA 연결 설계 | 공동 | 레코더·오브·schema(Dexie v2)와 함께 |
| 6 | F5 `fearful` 처리 결정 (실측 데이터 확인 후) | 이정환 | raw 경계 계약 |
| 7 | F8 이름 정리 (`riskCalculator.ts`) | 이정환 | 기능 변경 없는 별도 커밋 |

계산 결과가 바뀌는 작업(1~3, 5, 6)은 기존 기록과의 연속성과 테스트 기대값 변경을 PR에 명시하고, 하나씩 작은 PR로 나눈다.
