# 표정 기반 스트레스 지표: 정의와 근거

- 작성: 이정환 (⑤ 감정 및 개인 상태 분석), 2026-10-19
- 목적: "스트레스 지수 계산 방식이 모호하다"는 지적에 답하기 위해, 현재 지표가 **무엇을 재는지**, **어떤 가정에 근거가 있고 없는지**, **어떻게 검증할지**를 정리한다.
- 조사 방법: 이정환(Claude Code)과 Codex가 각각 문헌을 검색하고 서로의 출처를 교차 확인했다. 초록·요약 수준에서 확인한 수치는 그렇게 표시했다.

## 1. 결론 요약

1. 현재 지표는 **"웹캠 표정 분류 점수로 추정한 부정 정서 표출 지표"**다. 실제 스트레스 상태를 직접 재는 검증된 지수가 아니다. 앞으로 문서·발표에서는 이 정의를 쓴다.
2. 긍정·부정을 두 축으로 나누는 구조는 정서 이론(PANAS)에서 **착안한 설계**이며, 이 구현이 그 이론에 맞게 작동하는지는 아직 검증하지 않았다. 개인 기준선 대비 평가는 개인차 보정이 필요하다는 문헌 근거가 있다.
3. 화남 가중치 1.5에는 근거를 찾지 못했다. 이번 변경에서 **1.0(가중 없음)으로 되돌리고**, 그 결과 지표 범위가 설명대로 0~100이 된다(5절).
4. 스트레스 판정은 장기적으로 표정(쾌·불쾌) + 심박(각성) + 자기보고를 함께 쓰는 방식을 **가설로** 제안하고, 자기보고와의 비교로 검증한다(6·7절).

## 2. 현재 지표의 정의

얼굴이 검출된 약 0.5초 프레임마다 face-api 표정 확률을 4감정으로 정규화한다(`normalizeExpressions`).

- 기쁨 = happy, 평온 = neutral, 슬픔 = sad, 화남 = angry + disgusted
- face-api의 fearful·surprised는 버리고, 남은 네 값의 합이 1이 되도록 다시 나눈다.

프레임을 1분 단위로 평균해 저장하고(`aggregate`), 원하는 구간(오늘, 최근 30분, 2시간 단위)에 대해 측정 시간 가중 평균을 낸다(`aggregateStress`).

```text
긍정 P = 100 × Σ(기쁨 × 시간) / Σ시간
부정 N = 100 × Σ((슬픔 + w × 화남) × 시간) / Σ시간      w = ANGRY_WEIGHT
```

판정(`baseline.ts`):

- 기준선: 과거 13일 중 하루 측정 시간이 5분 이상인 날(유효일)이 3일 이상이면 그 날들의 N 중앙값을 개인 기준선으로 쓴다. 추이 차트는 별도로 과거 6일 기록으로 기준선을 구한다.
- 상대 판정: 오늘 N에 자기보고 보정값을 더한 값(0~100으로 제한)을 기준선으로 나눈 비율로 정한다. `high`·`veryHigh`는 보정된 N이 20 이상일 때만 나온다.
- 절대 판정: 유효일이 3일 미만이거나 기준선이 0이면 구간값 15/30/50으로 정한다.

**N이 뜻하는 것**: 측정 구간에서 표정 분류 점수 중 슬픔·화남·혐오 몫의 가중 평균(0~100)이다. 부정 표정이 실제로 나타난 **시간 비율이 아니다.** 예를 들어 face-api 원래 값이 fearful 0.99, sad 0.01인 프레임은 fearful을 버리고 다시 나누므로 N = 100이 된다. 감정을 느낀 정도나 생리적 스트레스와 같다고 보지 않는다.

## 3. 문헌 근거가 있는 부분

### 3.1 긍정·부정을 두 축으로 보기 (이론적 착안)

- Watson, Clark, Tellegen(1988)은 PANAS에서 긍정 정서와 부정 정서를 서로 상관이 낮은 두 차원으로 측정했다. 이후 연구에서도 두 요인이 반복해서 나타났지만, 표본과 모형 설정에 따라 적합도가 엇갈린다는 결과도 있다.
- PANAS는 자기보고 문항 척도다. 표정 점수 `happy`가 긍정 정서에, `sad + angry`가 부정 정서에 대응한다거나 두 값이 서로 독립이라는 것을 PANAS가 검증해 주지는 않는다.
- 함의: 하나의 "기분 점수" 대신 P와 N을 따로 보여 주는 구조는 이론에서 착안한 합리적인 설계다. 다만 "이론적으로 검증된 구조"라고 설명하지 않는다.

### 3.2 개인 기준선 대비 평가

- 생리·행동 신호에는 개인차가 커서, 개인별 기준으로 정규화해야 한다는 결과가 반복된다. 운전 스트레스 연구에서 개인 간 정규화로 분류 정확도가 68%에서 73%로 올랐다는 보고가 있다(초록 확인).
- 2026년 비교 연구(서지 미확인, 8절 참고)는 정규화 방법의 선택보다 개인차를 보정하는 것 자체가 중요하다고 보고했다. 또 정규화 통계를 평가 데이터와 겹치게 만들면 성능이 부풀려진다고 경고했다.
- 함의: 현재 기준선은 오늘을 제외한 과거 기록으로 만들므로 이 경고를 지킨다. "평소 대비" 표현을 유지한다. 위 연구들은 주로 생리 신호를 다뤘으므로, 표정 점수에도 같은 효과가 있는지는 검증 대상이다.

### 3.3 시간 정보 활용 (검증할 가설)

- 얼굴 영상 기반 스트레스 인식에서 시간 정보를 함께 쓰면 성능이 좋아졌다(Jeon 외 2021, 2초 클립·시간 주의 기법). 웨어러블 스트레스 데이터셋 WESAD는 대부분의 생리 특징을 60초 창으로 계산했다(Schmidt 외 2018).
- 함의: 시간 정보를 쓰는 방향에는 근거가 있다. 그러나 생리 신호의 60초 창이 표정 확률의 1분 평균을 정당화하지는 않는다. 1분 집계와 "부정 표정이 3초 이상 지속될 때만 인정"하는 규칙(v2 설계, 현재 미적용) 모두 검증할 매개변수로 다룬다.

## 4. 근거가 약하거나 한계가 있는 부분

### 4.1 표정으로 정서를 읽는다는 전제

- Barrett 외(2019)는 얼굴 움직임과 정서의 관계가 문화·상황·개인에 따라 크게 달라지고, 같은 움직임이 여러 정서나 비정서적 의미를 가질 수 있다고 정리했다. 얼굴 정보가 쓸모없다는 결론은 아니다.
- 자동 표정 분류기는 연출된 표정보다 자연스러운 표정에서 정확도가 낮다. 상용 분류기 8종의 정확도는 48~62%였다(Dupré 외 2020). 연출 표정이 더 전형적이어서 분류가 쉽다(Krumhuber 외 2020).

### 4.2 감정노동자의 표정 관리

- 표정을 억누르라는 지시를 받은 참가자는 표현 행동이 줄었지만 주관적 정서 경험은 줄지 않았다(Gross·Levenson 1993). 이 1993년 연구의 생리 반응은 엇갈린 양상이었다. 168명 대상 반복 연구(Roberts·Levenson·Gross 2008)에서는 표정 억제가 표정 감소, 심혈관 활성 증가, 주관적 정서 변화 없음과 관련이 있었다.
- 서울 콜센터 상담원 274명 조사에서 표면 연기는 우울 증상과 관련이 있었다(Kim·Choo 2017, 자기보고·횡단 연구).
- 함의: 온마음의 주 사용자는 업무 중 표정을 관리한다. **부정 표정이 적다고 부담이 적다고 볼 수 없다.** 이 한계는 README의 "표정 관리 시 부담이 과소평가될 수 있음"과 같은 내용이며, 화면 안내와 발표에서 명시한다.

### 4.3 화남 가중치 1.5

- 코드 주석은 "화남 인식률 보정 가중치"라고만 적고, 근거 메모(`project_step4_anger_compensation`)는 당시 개발자의 개인 메모로 저장소에 없다.
- 이번 조사에서 화남을 슬픔의 1.5배로 평가해야 한다는 실증 근거, 또는 자동 표정 인식이 화남을 특히 덜 인식한다는 근거를 찾지 못했다. 자연스러운 표정 전반의 인식률이 낮다는 결과는 있지만 화남만의 문제로 특정되지 않았다.
- 가중치 때문에 N의 범위가 0~150이 되어 "0~100" 설명과 맞지 않았다.

## 5. 이번 변경: 화남 가중치 1.5 → 1.0

| 항목 | 내용 |
|---|---|
| 변경 | `ANGRY_WEIGHT`를 1.5에서 1.0으로 바꾼다. 상수는 남겨 향후 검증 결과로 조정할 수 있게 한다 |
| 범위 | `슬픔 + 화남 ≤ 1`이므로 N이 항상 0~100 안에 든다 |
| 과거 기록 | 레코드에는 감정 확률만 저장되고 N은 읽을 때 계산한다. 업데이트 후에는 과거 기록과 기준선도 새 식으로 다시 계산되므로, 새 버전 안에서는 기록 사이의 불연속이 없다. 다만 업데이트 전에 화면에 보였던 값은 보존되지 않고, 이전 값을 보고 누적된 자기보고 보정값(`calibrationOffset`)은 그대로 남는다 |
| 값 변화 | 화남이 섞인 구간의 N이 낮아진다. 예: 화남 0.4만 있는 구간은 60 → 40 |
| 상대 판정 영향 | 오늘과 기준선이 같은 식으로 바뀌지만, 날마다 감정 구성이 다르면 비율이 크게 바뀔 수 있다. 예: 과거 날들이 화남 0.2(기준선 30 → 20)이고 오늘이 슬픔 0.33(N 33, 변화 없음)이면 비율이 1.1 → 1.65가 되어 `typical` → `veryHigh`로 바뀐다. 반대로 오늘 화남이 많고 과거엔 슬픔이 많았다면 판정이 낮아진다 |
| 절대 판정 영향 | 구간값 15/30/50이 그대로라 화남 비중이 큰 날은 낮게 판정된다. 보정값에 따라 두 단계까지 내려갈 수 있다. 예: 화남 0.44, 보정 −15이면 보정된 N이 51 → 29가 되어 `veryHigh` → `typical`. 절대 구간값도 근거 없이 정해진 값이라 이번에는 바꾸지 않고 검증(7절)에서 함께 다룬다 |
| 화면 영향 (김우빈 공유) | 리포트의 상태 배지·스트레스 게이지 숫자·가장 힘든 시간대, 추이 차트, 체크인 문구, 넛지 배너·알림 조건, `/demo` 리포트. 오브·PiP·최근 기록 목록은 스트레스 값을 쓰지 않아 직접 영향이 없다 |
| 공유 | 공개 상수와 화면 숫자가 바뀌므로 김우빈에게 PR로 공유한다. 1.5의 원래 근거 메모가 있으면 확인을 요청한다 |

v2 설계 문서와 과거 구현 계획(`docs/superpowers/**`)의 "×1.5" 표기는 당시 기록이므로 고치지 않는다.

## 6. 앞으로의 정의: 여러 신호로 판단하기 (가설)

- 정서 모델(Russell 1980)에서 스트레스·긴장은 "불쾌하면서 각성이 높은" 영역에 놓인다. 표정은 쾌·불쾌 쪽 정보는 주지만 각성 수준은 잘 담지 못한다.
- 심박변이도(HRV)는 심리적 스트레스의 객관적 지표로 쓸 근거가 있다(Kim 외 2018, 37편 검토). 단순 심박수 변화가 각성을 측정한다는 직접 근거는 아니므로, 심박 지표의 선택도 검증 대상이다.
- 얼굴 영상과 원격 맥박 정보를 함께 쓰는 연구들:
  - UBFC-Phys 원 논문: 원격 측정 맥박 변이 특징으로 스트레스 상태 인식 85.48%
  - 같은 데이터셋에서 얼굴 특징과 원격 맥박 변이를 결합한 연구: 91.07%
  - 모두 소규모 실험실 데이터이고 평가 방식이 서로 달라 직접 비교하거나 "결합하면 몇 % 오른다"고 말할 수 없다.
- 제안: rPPG 연동 이후 상태 판정을 다음 세 근거로 구성하고, 하나의 숫자 대신 근거를 함께 보여 주는 방식을 검증한다.
  1. 표정 부정 정서 N (쾌·불쾌)
  2. 개인 기준선 대비 심박 지표 (각성). 품질이 낮은 rPPG 결과는 제외한다
  3. 자기보고 (세션 전후, 체크인)

## 7. 검증 계획

| 단계 | 방법 | 비고 |
|---|---|---|
| 1 | 세션 전후 자기보고(긴장도·기분)와 세션 N의 상관 | 측정 세션 저장 기능 이후. 자기보고도 오차가 있는 기준이라는 점을 함께 적는다 |
| 2 | 공개 데이터셋(UBFC-Phys 등)에서 스트레스 과제 구간과 휴식 구간을 N이 구분하는 정도 | 데이터 사용 조건 확인 필요 |
| 3 | 화남 가중치·절대 구간값·집계 창·지속 게이트를 매개변수로 두고 1·2단계 결과로 비교 | 결과를 보고 값을 정한다 |
| 4 | rPPG 결합 후 표정 단독 대비 개선 여부 | 김우빈의 rPPG 결과 형식 합의 후 |

결과는 "탐색적 지표의 예비 검증"으로 보고하고, 의료·진단 표현을 쓰지 않는다.

## 8. 참고문헌

- Barrett, L. F., Adolphs, R., Marsella, S., Martinez, A. M., & Pollak, S. D. (2019). Emotional expressions reconsidered: Challenges to inferring emotion from human facial movements. *Psychological Science in the Public Interest*, 20(1), 1–68. https://doi.org/10.1177/1529100619832930
- Watson, D., Clark, L. A., & Tellegen, A. (1988). Development and validation of brief measures of positive and negative affect: The PANAS scales. *Journal of Personality and Social Psychology*, 54(6), 1063–1070. https://pubmed.ncbi.nlm.nih.gov/3397865/
- Russell, J. A. (1980). A circumplex model of affect. *Journal of Personality and Social Psychology*, 39(6), 1161–1178.
- Gross, J. J., & Levenson, R. W. (1993). Emotional suppression: Physiology, self-report, and expressive behavior. *Journal of Personality and Social Psychology*, 64(6), 970–986. https://doi.org/10.1037/0022-3514.64.6.970
- Roberts, N. A., Levenson, R. W., & Gross, J. J. (2008). Cardiovascular costs of emotion suppression cross ethnic lines. *International Journal of Psychophysiology*, 70(1), 82–87. https://doi.org/10.1016/j.ijpsycho.2008.06.003
- Kim, H.-J., & Choo, J. (2017). Emotional labor: Links to depression and work-related musculoskeletal disorders in call center workers. *Workplace Health & Safety*, 65(8), 346–354. https://doi.org/10.1177/2165079916667512
- Kim, H.-G., Cheon, E.-J., Bai, D.-S., Lee, Y. H., & Koo, B.-H. (2018). Stress and heart rate variability: A meta-analysis and review of the literature. *Psychiatry Investigation*, 15(3), 235–245. https://doi.org/10.30773/pi.2017.08.17
- Sabour, R. M. 외 (2021). UBFC-Phys: A multimodal database for psychophysiological studies of social stress. *IEEE Transactions on Affective Computing*. https://doi.org/10.1109/TAFFC.2021.3056960
- Ouzar, Y. 외 (2023). Multimodal stress state detection from facial videos using physiological signals and facial features. *Lecture Notes in Computer Science* (ICPR 2022 워크숍). https://doi.org/10.1007/978-3-031-37745-7_10 (UBFC-Phys, 91.07%. 초록 확인, 공저자 목록 미확인)
- Jeon, T., Bae, H. B., Lee, Y., Jang, S., & Lee, S. (2021). Deep-learning-based stress recognition with spatial-temporal facial information. *Sensors*, 21(22), 7498. https://doi.org/10.3390/s21227498
- Schmidt, P., Reiss, A., Duerichen, R., Marberger, C., & Van Laerhoven, K. (2018). Introducing WESAD, a multimodal dataset for wearable stress and affect detection. *ICMI '18*. https://doi.org/10.1145/3242969.3242985
- Dupré, D., Krumhuber, E. G., Küster, D., & McKeown, G. J. (2020). A performance comparison of eight commercially available automatic classifiers for facial affect recognition. *PLOS ONE*. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7182192/
- Krumhuber, E. G. 외 (2020). Human and machine validation of 14 databases of dynamic facial expressions. *Behavior Research Methods*. https://link.springer.com/article/10.3758/s13428-020-01443-y
- Fruet, D., Barà, C., Pernice, R., Iovino, M., Faes, L., & Nollo, G. (2025). A signal normalization approach for robust driving stress assessment using multi-domain physiological data. *Eng*, 6(11), 288. https://doi.org/10.3390/eng6110288 (68%→73%, 초록 확인)
- 개인 정규화 방법 비교 연구(Frontiers in Digital Health, 2026): https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2026.1827279/full (**제목·저자 미확인.** 검색 요약으로만 확인했으므로 인용 전 원문 확인 필요)

수치 중 일부는 초록·요약 수준에서 확인했다. 발표·논문에 인용할 때는 원문에서 다시 확인한다.
