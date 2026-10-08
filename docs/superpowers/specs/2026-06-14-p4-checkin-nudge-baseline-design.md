# 온마음 v2 P4 잔여 — 개인 기준선 · 오전/오후 체크인 · 안전판 넛지 · /stats v2 마이그레이션

> 과거 설계·구현 계획 기록입니다. 현존 모듈의 경로 참조만 2026-10-07 구조로 갱신했습니다. 당시 동작·폐기된 기능·미완료 체크리스트는 현재 구현이나 실행 지침이 아닙니다. 현재 지침은 [AGENTS.md](../../../AGENTS.md)와 [Code Ownership](../../collaboration/CODE_OWNERSHIP.md), 실제 파일은 [프로젝트 구조](../../architecture/PROJECT_STRUCTURE.md)를 따릅니다.

작성일: 2026-06-14
상태: 설계 확정 (구현 전)
상위 spec: [2026-06-08-onmaum-v2-orb-stress-design.md](./2026-06-08-onmaum-v2-orb-stress-design.md)

## 0. 범위

상위 v2 spec의 **P4(개인화 피드백)** 중 미구현분을 마무리한다. 이미 완료: 온보딩 설문(`OnboardingSurvey`/`profile.ts`), 퇴근 리포트 1차(`DailyReport`, /demo에만 존재), `/measure` 오브 실데이터 배선.

이 문서가 다루는 잔여:

1. **개인 기준선** — "평소 대비"(하이브리드 절대↔상대). 상위 spec §4 [기준선] §58.
2. **오전/오후 체크인** — 30초 self-report 1탭 보정. §6-2, §104.
3. **안전판 넛지** — 지속된 N + 빈도 상한 + 토글. §6-4, §106.
4. **/stats v2 마이그레이션** — 구 Step6 위험 시스템(flatAffect 기반) 은퇴, v2 표면(리포트·체크인·넛지)의 실제 앱 내 거처 마련.

세 기능은 **개인 기준선을 공통 토대**로 공유하므로 하나의 spec으로 묶고, 구현은 **기준선 → 체크인 → 넛지 → /stats 통합** 순서로 진행한다.

## 1. 배경 / 현재 상태

- **P/N 엔진(P1)은 있으나 기준선 없음.** `features/algorithm/stress/stressIndex.ts`에 `aggregateStress`(절대식 P/N), `gateSustainedNegative`, `emaStress`는 있으나 "평소 대비" 로직 전무.
- **넛지 인프라가 구 시스템에 묶여 충돌.** `useRiskNotification`/`RiskWarningModal`/`DailyRiskCard`/`NotificationToggle`이 `riskCalculator`(good/caution/**warning**)에 연결돼 있고, **`flatAffectAvg`(무표정)를 위험 지표로 사용** → 상위 spec §4·§20("무표정 ≠ 소진, flatAffect를 위험 지표로 쓰지 않음")과 정면 충돌.
- **v2 퇴근 리포트가 데모에만 갇힘.** `DailyReport`(2축 P/N)는 `/demo`에서만 렌더, 실제 앱 네비(`측정`/`통계`)에서 도달 불가.
- **프로필이 빈약.** `Profile { reliefs: string[] }`뿐 — 넛지 설정(방해금지·빈도 상한·토글)·보정 오프셋 저장처 없음.
- **데이터 계층.** Dexie `emotions` 테이블(원시 레코드)만 존재. 일별 P/N 집계는 어디에도 영속화돼 있지 않음. `emotionRepository`에 `getEmotionsByDate`/`getEmotionsByDateRange` 보유.

## 2. 핵심 설계 결정 (확정)

| # | 결정 | 비고 |
|---|------|------|
| D1 | 통합 1개 spec, 구현 순서 **기준선 → 체크인 → 넛지 → /stats** | 공유 기준선/설정 모델 재논의 방지 |
| D2 | **/stats를 v2로 마이그레이션** | 구 flatAffect 경고 은퇴, 리포트/체크인/넛지의 실제 거처 |
| D3 | self-report = **보정 오프셋**(해석 가능·bounded·가역) | 로그/주석만(약함)·세션 스냅(일회성) 대신 채택 |
| D4 | 기준선 데이터 = **즉석 산출(on-the-fly)** | Dexie 신규 테이블 없음. 온디바이스·1인·소데이터 |
| D5 | 보정 오프셋·넛지 설정·체크인/넛지 상태 = **localStorage**(`profile.ts` 패턴) | 서버 폴백 없음 |

## 3. 모듈 분해

작은 단위·순수 로직 우선(독립 테스트 가능). 아래 **굵은 [기본값]**은 상수로 추출해 조정 가능하게 둔다.

### 신규 lib (순수 함수 — TDD 대상)

- **`features/algorithm/stress/dailyStress.ts`** — 원시 `EmotionRecord[]`를 사용자 로컬 날짜별로 묶어 일별 P/N 산출(즉석). 내부에서 기존 `aggregateStress` 재사용.
  - `dailyStressFor(records, date): StressScores | null`
  - `dailyStressHistory(records, days): { date, scores, totalDuration }[]` (오래된→최근)
- **`features/algorithm/baseline/baseline.ts`** — 일별 N 이력 → 개인 기준선 + "평소 대비" 분류(하이브리드).
- **`features/algorithm/baseline/calibration.ts`** — self-report 보정 오프셋 모델(증감·클램프·적용·리셋).
- **`features/feedback/lib/checkin.ts`** — 오전/오후 시간창 판정 + due 여부(순수).
- **`features/feedback/lib/nudge.ts`** — `shouldNudge(...)` 순수 정책 함수.
- **`shared/storage/settings.ts`** — 넛지 설정·보정 오프셋·체크인/넛지 상태 load/save(localStorage). `profile.ts`와 동일한 방어적 파싱 패턴.

### 신규 hooks

- **`features/feedback/hooks/useCheckin.ts`** — due 감지 + self-report 처리(오프셋 갱신·로그 저장).
- **`features/feedback/hooks/useNudge.ts`** — 앱 전역(`AppChrome` 마운트)에서 오늘 레코드 liveQuery → `shouldNudge` 평가 → Notification/인앱 배너. **구 `useRiskNotification` 대체.**

### 신규 components

- **`features/feedback/components/CheckInCard.tsx`** — 체크인 카드(지금 한 줄 + `맞아요`/`지금은 좀 달라요` 1탭 + 방향 2지선다).
- **`features/feedback/components/NudgeSettings.tsx`** — 토글·하루 빈도 상한·방해금지 시간. **구 `NotificationToggle` 대체.** 알림 권한 요청 포함.
- **`features/ui/report/DailyReport.tsx` 확장** — 평소 대비 배지 + 추이 + 힘들었던 시간대 추가.

### 변경 / 은퇴

- `app/stats/page.tsx` → v2 리포트 표면으로 교체(§7).
- 라우트에서 제거(은퇴): `DailyRiskCard`, `RiskWarningModal`, 구 `SelfCareTip`, `NotificationToggle`, `useRiskNotification`, `useWarningDismissal`.
- `TrendChart` → P/N 추이로 갱신(§7).
- **`riskCalculator.ts` 상수 유지**: `ANGRY_WEIGHT`, `MIN_RECORD_DURATION_MS`는 `stressIndex.ts`가 import하므로 보존. 미사용 함수(`calculateRiskLevel`/`aggregateDailyRisk`)의 삭제 vs 보존은 구현 plan에서 결정(상수만 별도 모듈로 옮기는 안 포함).

## 4. 개인 기준선 (`baseline.ts`)

- 입력: 최근 **[14일]**의 일별 N(오늘 제외).
- **유효일** = 그 날 측정 총 duration ≥ **[5분]** 인 날.
- **하이브리드 게이트**: 유효일 **[≥3일]** → 상대(relative) 모드, 미만 → 절대(absolute) 모드.
- 기준선 통계 = 유효일 N의 **median**(하루 폭발에 강건; mean 대비).
- "평소 대비" 4밴드 `level: 'low' | 'typical' | 'high' | 'veryHigh'`:
  - **상대 모드**: `ratio = value / baselineN` → `<0.8 low / 0.8–1.25 typical / 1.25–1.6 high / >1.6 veryHigh` **[기본 비율]**.
    - **절대 하한**: `baselineN`이 매우 낮을 때 과민반응 방지 — `value < [20]`이면 `high` 이상으로 승격하지 않음.
  - **절대 모드**: N 임계 `<15 low / 15–30 typical / 30–50 high / >50 veryHigh` **[기존 risk 임계 NEGATIVE_GOOD=0.3·WARNING=0.5 ×100 유래]**.
- **재사용 가능한 분류기**: `classifyStress(value, baselineState): { mode, level }`를 핵심 함수로 둔다. 여기서 `value`는 분류 대상 N(보정 적용 N′ 포함 가능) — 리포트는 `todayN`, 체크인은 현재값, 넛지는 현재 N′를 넣는다. `baselineState = { mode, baselineN }`는 이력에서 한 번 계산해 공유.
- 출력(편의): `dailyStressHistory` → `baselineState` → `classifyStress(todayN, baselineState)`로 리포트용 `{ mode, level, baselineN, todayN }` 조립.

## 5. 오전/오후 체크인 (`checkin.ts` + `useCheckin` + `CheckInCard`)

- 시간창 **[오전 10:00–12:00 / 오후 15:00–17:00]**, 각 창 하루 1회.
- **due** = 현재 창 안 + 오늘 그 창 미완료 + 오늘 측정 데이터 존재.
- 카드 내용:
  - "지금 한 줄": 현재값(아래 "지금값 출처")으로 분류한 상태를 토스톤 한 줄(`orbCaption` 톤 재사용) + 기준선 있으면 "평소보다 …"(`classifyStress`).
  - 1탭: `[맞아요]` / `[지금은 좀 달라요]`. '달라요' → 방향 2지선다 `더 힘들었어요` / `사실 괜찮았어요` → 보정 오프셋 갱신(§6).
- 위치: **/stats 상단**(창 안일 때만 노출). 모달 아님, 닫기 쉬움(과개입 금지, 상위 spec §21).
- "지금값" 출처: 오늘 최근 **[30분]** 레코드로 즉석 산출(카메라 비활성 시에도 동작).
- 상태 저장: `checkin:{date}:{window} = { agree, direction?, at }` (localStorage via `settings.ts`).

## 6. self-report 보정 오프셋 (`calibration.ts`)

- 모델: `offset ∈ [-[15], +[15]]`, N(0~100)에 가산.
- 갱신: `더 힘들었어요` → `+[3]`, `괜찮았어요` → `-[3]`, `맞아요` → 0 방향 `-[1]` 감쇠. 모두 범위 클램프.
- 적용: 표시·리포트·넛지에서 `N′ = clamp(N + offset, 0, 100)`. **원시 `EmotionRecord`는 불변**(정직: 추정 원본 보존, 보정은 표시 계층에서만).
- 로그: 모든 self-report 기록 보존 → 리포트 주석("오전엔 평소와 다르게 느끼셨네요").
- **가역**: 설정에서 오프셋 초기화 가능.

> N′(보정 적용)은 §5 체크인 "지금값", §7 리포트 게이지, §6 넛지 트리거 모두에서 일관되게 사용한다. 단 §7 추이 그래프의 과거 일자는 그 날의 보정 맥락이 다르므로 원본 N(미보정)으로 그린다(혼선 방지).

## 7. 안전판 넛지 (`nudge.ts` + `useNudge` + `NudgeSettings`)

- **발화 조건(전부 충족)**:
  1. 토글 ON
  2. N′ level ∈ {`high`, `veryHigh`}가 **[5분]** 지속
  3. 현재 방해금지 시간대 아님
  4. 오늘 발화 횟수 **[≤2회]**
  5. 직전 발화 후 **[≥90분]**(쿨다운)
- 표현: 부드러운 브라우저 Notification + (앱 열림 시) 인앱 배너. 카피 비단정("마음에 힘이 들어간 지 좀 됐어요. 잠깐 숨 돌릴까요?") + 회복 제안(`suggestionFor` 프로필 기반) + `[좋아요]` / `[나중에]` / `[오늘은 그만]`.
- 상태: `nudge:{date} = { count, lastAt }` (localStorage).
- **flatAffect 트리거 완전 제거**(상위 spec §4·§20 준수). 알림 권한 거부 시 인앱 배너만.
- 위치: `useNudge`를 `AppChrome`에 마운트해 앱 전역 동작(측정 중이든 통계 보는 중이든).

## 8. /stats v2 마이그레이션

새 구성(위→아래):
1. `CheckInCard` (현재 체크인 창 안일 때만)
2. `DailyReport` v2 — 오늘 P/N 게이지(N′ 적용) + **평소 대비 배지**(기준선) + **추이 그래프** + **힘들었던 시간대** + 회복 제안
3. `NudgeSettings` — 토글·빈도·방해금지
4. `RecentRecords` (유지)

- `TrendChart` → **최근 7일 N(스트레스) 막대 + 기준선 점선**. 색은 risk 토큰(good/caution/warning) 대신 N 강도 표현. 부정비율/평탄도 표기 제거.
- "힘들었던 시간대" = 오늘 레코드를 시간대 버킷(예: 1~2시간)으로 묶어 N 최고 구간 1개 표기.

## 9. 데이터 흐름

```
emotions(Dexie, 원시)
   └─ dailyStress (즉석, 날짜 그룹핑)
        └─ baseline (median·하이브리드 게이트)
             └─ {체크인 카피 · 리포트 평소대비 · 넛지 트리거}

self-report ──► calibration.offset (localStorage) ──► N′ = clamp(N+offset)
settings (localStorage) ──► 체크인 시간창 · 넛지 토글/빈도/방해금지
```

## 10. 에러 처리 / 프라이버시

- localStorage/Dexie 실패 시 조용히 fallback(기존 방어적 패턴), **서버 폴백 없음**.
- Notification 권한 없음/거부 시 인앱 배너만.
- 보정·넛지 모두 옵트아웃·초기화 가능, 데이터 기기에만(상위 spec §12).

## 11. 테스트 (TDD)

순수 로직 우선:
- `dailyStress` — 날짜 그룹핑(로컬 자정 경계), 빈 데이터 → null.
- `baseline` — 유효일 게이트(절대↔상대 전환), median, 밴드 경계값, 절대 하한.
- `calibration` — 증감·클램프(±한계)·적용(N′)·리셋·`맞아요` 감쇠.
- `nudge.shouldNudge` — 조건별 분기(토글 off / 지속 미달 / 방해금지 / 빈도 초과 / 쿨다운 미경과 / 기준선 high).
- `checkin` — 창 경계 시각, 하루 1회 due 판정.

컴포넌트는 기존 패턴 따른 경량 렌더 테스트(있는 경우).

## 12. 비목표 (Out of Scope)

- 누적 ML 기반 보정(설계 검토 시 B안) — 단순 오프셋만.
- 서버/계정/동기화 — 없음.
- 일별 P/N 롤업 영속화(Dexie 신규 테이블) — 즉석 산출로 충분.
- `EmotionDisplay`(/measure 이산 감정 바, 상위 spec §32 위반) 제거 — **별도 follow-up으로 노트만**, 이 spec 미포함.
- HSEmotion 모델 교체(P6) — 무관.

## 13. 오픈 이슈 / 후속

- `EmotionDisplay`(/measure 이산 바) 제거 follow-up.
- `riskCalculator.ts` 미사용 함수 정리(상수 재배치) — 구현 plan에서 결정.
- N에 변동성 포함 여부는 상위 spec §15대로 계속 보류.
