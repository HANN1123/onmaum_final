// 실험실 파형 기록. 측정 중 두 모델의 맥박 파형(BVP)·얼굴 상자·워치 심박을 그대로 모아 내보낸다.
// 구간별 결과(CSV)만으로는 후처리(창 길이·필터·추적)를 바꿔 다시 계산할 수 없어서, 같은 측정을 오프라인에서
// 여러 방식으로 재계산할 수 있게 원시 출력을 남긴다. 영상·얼굴 이미지는 기록하지 않는다(모델 출력 숫자와 상자 좌표만).

import type { StateModelId } from './meRppg'
import type { ReferenceSample } from './rppg'

/** 한 측정에서 모델당 최대 기록 수. 30fps 기준 약 33분 */
export const WAVE_LOG_MAX = 60_000

export interface WaveLog {
  /** 기록 시각의 기준(ms, performance.now 시계). 내보낼 때 모든 시각을 이 값 기준 상대 시각으로 바꾼다 */
  startedAt: number
  models: Record<StateModelId, { t: number[]; v: number[] }>
  box: { t: number[]; cx: number[]; cy: number[]; w: number[] }
  markers: { t: number; label: string }[]
}

export function createWaveLog(startedAt: number): WaveLog {
  return {
    startedAt,
    models: { me: { t: [], v: [] }, facephys: { t: [], v: [] } },
    box: { t: [], cx: [], cy: [], w: [] },
    markers: [],
  }
}

/** 유한한 값만 기록한다. 가득 차면 더 받지 않는다(앞부분을 지우면 표식·워치와 시각이 어긋나 보인다) */
export function logBvp(log: WaveLog, id: StateModelId, t: number, v: number): void {
  const m = log.models[id]
  if (!Number.isFinite(v) || m.t.length >= WAVE_LOG_MAX) return
  m.t.push(t)
  m.v.push(v)
}

export function logBox(log: WaveLog, t: number, cx: number, cy: number, w: number): void {
  if (log.box.t.length >= WAVE_LOG_MAX) return
  log.box.t.push(t)
  log.box.cx.push(cx)
  log.box.cy.push(cy)
  log.box.w.push(w)
}

export function logMarker(log: WaveLog, t: number, label: string): void {
  log.markers.push({ t, label })
}

const rel = (t: number, origin: number) => Math.round((t - origin) * 10) / 10

/** 내보내기 형식(JSON). 시각은 모두 측정 시작 기준 ms */
export function waveLogToJson(log: WaveLog, watch: readonly ReferenceSample[]): string {
  const o = log.startedAt
  const series = (s: { t: number[]; v: number[] }) => ({ t: s.t.map((t) => rel(t, o)), v: s.v })
  return JSON.stringify({
    format: 'onmaum-rppg-wave',
    version: 1,
    models: { me: series(log.models.me), facephys: series(log.models.facephys) },
    box: { t: log.box.t.map((t) => rel(t, o)), cx: log.box.cx, cy: log.box.cy, w: log.box.w },
    watch: watch.filter((s) => s.t >= o).map((s) => ({ t: rel(s.t, o), bpm: s.bpm, contact: s.contact })),
    markers: log.markers.map((m) => ({ t: rel(m.t, o), label: m.label })),
  })
}
