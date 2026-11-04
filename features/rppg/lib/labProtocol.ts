// 자동 평가 절차: 준비 구간 뒤 120초 동안 15초마다 슬롯을 하나씩 남긴다.
// 실패한 슬롯도 지우지 않는다. 지우면 연결이 잘된 순간만 남아 유효율이 부풀려진다.

import type { Condition, HeartRate, LabRow, ReferenceValue, RoiSet } from '@/features/rppg/lib/rppg'

export const PREP_MS = 10_000
export const SLOT_MS = 15_000
export const SLOT_COUNT = 8
/** 추정 창 끝이 슬롯 시각에서 이만큼 벗어나면 같은 구간으로 비교하지 않는다 */
export const MAX_ALIGN_MS = 2_000
/** 기준값은 최근 10초 평균이다. 이보다 짧은 창은 다른 구간을 재는 셈이라 비교하지 않는다 */
export const MIN_COMPARE_WINDOW_MS = 9_000
/** 슬롯 처리가 이만큼 늦으면 탭이 멈췄던 것으로 보고 평가에서 뺀다 */
export const MAX_SLOT_LATE_MS = 2_000

export interface Evaluation {
  runId: string
  condition: Condition
  /** 평가 전에 고정한 품질 게이트. 결과를 본 뒤 바꿔 판정이 달라지지 않게 한다 */
  gateDb: number
  /** 준비 구간이 끝나고 평가가 시작되는 시각 */
  evalStart: number
  nextSlot: number
}

/** 지금까지 처리해야 하는 슬롯 번호. 첫 슬롯은 평가 시작 15초 뒤다 */
export function dueSlots(evaluation: Evaluation, now: number): number[] {
  const last = Math.min(SLOT_COUNT, Math.floor((now - evaluation.evalStart) / SLOT_MS))
  const due: number[] = []
  for (let slot = evaluation.nextSlot; slot <= last; slot++) due.push(slot)
  return due
}

const ESTIMATORS: RoiSet[] = ['forehead', 'all', 'me', 'fp', 'fx']

export interface SlotInput {
  evaluation: Evaluation
  slot: number
  /** 슬롯을 실제로 처리한 시각 */
  now: number
  /** 측정 시작 기준 시각 */
  startedAt: number
  /** FacePhys·튜닝 추정(fx)은 켰을 때만 넣는다. 키가 없으면 그 추정기는 이 슬롯의 비교·이유에서 빠진다 */
  estimates: Record<Exclude<RoiSet, 'fp' | 'fx'>, HeartRate | null> & { fp?: HeartRate | null; fx?: HeartRate | null }
  reference: ReferenceValue | null
  fps: number
  meOutFps: number
  meDropped: number
  fpOutFps?: number
  fpDropped?: number
  /** 튜닝 추정의 움직임 진폭(얼굴 너비 대비) */
  fxMotion?: number | null
}

/** 창이 평가 구간 안에 있고 슬롯 시각·기준값 구간에 맞는 추정만 비교한다. 아니면 그 이유를 돌려준다 */
function rejectReason(est: HeartRate | null, slotAt: number, evalStart: number): string | null {
  if (!est || est.windowStart === undefined || est.windowEnd === undefined) return 'none'
  if (est.windowStart < evalStart) return 'before_eval'
  if (est.windowEnd - est.windowStart < MIN_COMPARE_WINDOW_MS) return 'short_window'
  if (Math.abs(slotAt - est.windowEnd) > MAX_ALIGN_MS) return 'misaligned'
  return null
}

export function slotRow(input: SlotInput): LabRow {
  const { evaluation, slot, now, startedAt, reference } = input
  const slotAt = evaluation.evalStart + slot * SLOT_MS
  const late = now - slotAt > MAX_SLOT_LATE_MS

  const active = ESTIMATORS.filter((k) => k in input.estimates)
  const rejects = active.map((k) => [k, rejectReason(input.estimates[k] ?? null, slotAt, evaluation.evalStart)] as const)
  const aligned = Object.fromEntries(
    rejects.map(([k, why]) => [k, late || why ? null : (input.estimates[k] ?? null)]),
  ) as SlotInput['estimates']
  const usableRef = late ? null : reference

  const reasons: string[] = []
  if (late) reasons.push('timer_late')
  else {
    if (!usableRef) reasons.push('no_reference')
    if (active.every((k) => !aligned[k])) reasons.push('no_rppg')
    for (const [k, why] of rejects) if (why) reasons.push(`${k}:${why}`)
  }

  return {
    runId: evaluation.runId,
    source: 'ble',
    slot,
    conditionSec: slot * (SLOT_MS / 1000),
    reason: reasons.length > 0 ? reasons.join('+') : null,
    gateDb: evaluation.gateDb,
    originMs: startedAt,
    t: (slotAt - startedAt) / 1000,
    condition: evaluation.condition,
    watch: usableRef?.bpm ?? null,
    refAgeS: usableRef?.ageS ?? null,
    refN: usableRef?.n ?? null,
    fps: input.fps,
    meOutFps: input.meOutFps,
    meDropped: input.meDropped,
    ...(input.fpOutFps !== undefined ? { fpOutFps: input.fpOutFps } : {}),
    ...(input.fpDropped !== undefined ? { fpDropped: input.fpDropped } : {}),
    ...(input.fxMotion !== undefined ? { fxMotion: late ? null : input.fxMotion } : {}),
    ...aligned,
  }
}

/** 평가를 중간에 멈추면 남은 슬롯을 실패로 남겨 분모를 유지한다 */
export function abortedRows(evaluation: Evaluation, startedAt: number): LabRow[] {
  const rows: LabRow[] = []
  for (let slot = evaluation.nextSlot; slot <= SLOT_COUNT; slot++) {
    rows.push({
      runId: evaluation.runId,
      source: 'ble',
      slot,
      conditionSec: slot * (SLOT_MS / 1000),
      reason: 'aborted',
      gateDb: evaluation.gateDb,
      originMs: startedAt,
      t: (evaluation.evalStart + slot * SLOT_MS - startedAt) / 1000,
      condition: evaluation.condition,
      watch: null,
      refAgeS: null,
      refN: null,
      fps: 0,
      forehead: null,
      all: null,
      me: null,
      fp: null,
      fx: null,
    })
  }
  return rows
}

/** 실행과 기준값 출처가 다른 결과는 섞어서 집계하지 않는다 */
export function runKey(row: LabRow): string {
  return `${row.runId ?? '이전 기록'} · ${row.source === 'ble' ? '자동' : '수동'}`
}

function csvNumber(v: number | null | undefined, digits: number): string {
  return v === null || v === undefined || !Number.isFinite(v) ? '' : v.toFixed(digits)
}

function estimateColumns(row: LabRow, roi: RoiSet): string[] {
  const est = row[roi]
  const origin = row.originMs
  const relative = (ms: number | undefined) => (ms === undefined || origin === undefined ? null : (ms - origin) / 1000)
  const end = relative(est?.windowEnd)
  return [
    csvNumber(est?.bpm, 1),
    csvNumber(est?.snrDb, 1),
    csvNumber(relative(est?.windowStart), 2),
    csvNumber(end, 2),
    csvNumber(end === null ? null : row.t - end, 2),
  ]
}

export function rowsToCsv(rows: LabRow[]): string {
  const head = [
    'run_id,ref_source,slot,condition,condition_s,t_s,reason,gate_db,watch_bpm,ref_age_s,ref_n',
    'forehead_bpm,forehead_snr_db,forehead_win_start_s,forehead_win_end_s,forehead_age_s',
    'all_bpm,all_snr_db,all_win_start_s,all_win_end_s,all_age_s',
    'me_bpm,me_snr_db,me_win_start_s,me_win_end_s,me_age_s',
    'me_out_fps,me_dropped,fps',
    // FacePhys 열은 기존 열 순서를 바꾸지 않게 맨 뒤에 붙인다
    'fp_bpm,fp_snr_db,fp_win_start_s,fp_win_end_s,fp_age_s,fp_out_fps,fp_dropped',
    // 튜닝 추정 열도 맨 뒤에 붙인다
    'fx_bpm,fx_snr_db,fx_win_start_s,fx_win_end_s,fx_age_s,fx_motion',
  ].join(',')
  const lines = rows.map((r) =>
    [
      r.runId ?? '',
      r.source ?? 'manual',
      r.slot ?? '',
      r.condition,
      r.conditionSec ?? '',
      r.t.toFixed(1),
      r.reason ?? '',
      r.gateDb ?? '',
      r.watch ?? '',
      csvNumber(r.refAgeS, 1),
      r.refN ?? '',
      ...estimateColumns(r, 'forehead'),
      ...estimateColumns(r, 'all'),
      ...estimateColumns(r, 'me'),
      csvNumber(r.meOutFps, 1),
      r.meDropped ?? '',
      r.fps.toFixed(0),
      ...estimateColumns(r, 'fp'),
      csvNumber(r.fpOutFps, 1),
      r.fpDropped ?? '',
      ...estimateColumns(r, 'fx'),
      csvNumber(r.fxMotion, 4),
    ].join(','),
  )
  return [head, ...lines].join('\n')
}
