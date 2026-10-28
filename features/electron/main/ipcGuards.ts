/**
 * IPC 수신 검증: 채널별 허용 창, payload 모양. electron을 import하지 않는 순수 모듈.
 */
import {
  CHANNELS,
  type ChannelName,
  type DesktopEmotion,
  type MeasurementSnapshot,
  type WindowRole,
} from '../types/bridge'
import type { RunModeName } from './runMode'
import { isTrustedUrl, isWidgetUrl } from './trust'

const ALLOWED_ROLE: Record<ChannelName, WindowRole | null> = {
  [CHANNELS.publishMeasurement]: 'main',
  [CHANNELS.getMeasurement]: 'widget',
  [CHANNELS.openMainWindow]: 'widget',
  [CHANNELS.getSettings]: 'main',
  [CHANNELS.setWidgetEnabled]: 'main',
  // main → renderer 전용. renderer에서 오면 받지 않는다.
  [CHANNELS.measurementUpdate]: null,
}

export function isAllowedSender(channel: string, role: WindowRole): boolean {
  if (!Object.hasOwn(ALLOWED_ROLE, channel)) return false
  const allowed = ALLOWED_ROLE[channel as ChannelName]
  return allowed !== null && allowed === role
}

export interface SenderInfo {
  channel: string
  role: WindowRole
  /** senderFrame이 그 창의 최상위 프레임인지 */
  isTopFrame: boolean
  /** senderFrame의 현재 URL */
  frameUrl: string | undefined
  mode: RunModeName
}

/** 채널별 허용 창 + 최상위 프레임 + 현재 URL(위젯은 /widget/)을 모두 확인한다. */
export function isTrustedSender(info: SenderInfo): boolean {
  if (!isAllowedSender(info.channel, info.role)) return false
  if (!info.isTopFrame || !info.frameUrl) return false
  if (info.role === 'widget') return isWidgetUrl(info.frameUrl, info.mode)
  return isTrustedUrl(info.frameUrl, info.mode) && !isWidgetUrl(info.frameUrl, info.mode)
}

/** 기록 수 상한. 그보다 크면 잘못된 값으로 본다 */
const MAX_RECORD_COUNT = 10_000_000
/** 비정상 fps 상한 */
const MAX_FPS = 1000

function isUnitNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
}

function parseEmotion(v: unknown): DesktopEmotion | null | undefined {
  if (v === null) return null
  if (typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const keys = Object.keys(o)
  if (keys.length !== 4) return undefined
  const { happy, calm, sad, angry } = o
  if (![happy, calm, sad, angry].every(isUnitNumber)) return undefined
  return { happy: happy as number, calm: calm as number, sad: sad as number, angry: angry as number }
}

/** 검증한 새 객체를 돌려준다. 잘못되면 null. */
export function parseSnapshot(v: unknown): MeasurementSnapshot | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (Object.keys(o).length > 5) return null

  if (typeof o.active !== 'boolean') return null

  const emotions = parseEmotion(o.emotions)
  if (emotions === undefined) return null

  const { recordCount, videoFps, sentAt } = o
  if (
    typeof recordCount !== 'number' ||
    !Number.isInteger(recordCount) ||
    recordCount < 0 ||
    recordCount > MAX_RECORD_COUNT
  ) {
    return null
  }
  if (
    videoFps !== null &&
    (typeof videoFps !== 'number' || !Number.isFinite(videoFps) || videoFps < 0 || videoFps > MAX_FPS)
  ) {
    return null
  }
  if (typeof sentAt !== 'number' || !Number.isFinite(sentAt) || sentAt < 0) return null

  return { active: o.active, emotions, recordCount, videoFps: videoFps as number | null, sentAt }
}

export function parseEnabledFlag(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}
