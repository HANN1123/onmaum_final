'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useNotificationPermission } from '@/features/feedback/hooks/useNotificationPermission'
import { checkinChoice, checkinSlotsFor, type CheckinChoice } from '@/features/feedback/lib/careSurvey'
import { loadConsent, saveConsent, type StorageConsent } from '@/shared/storage/consent'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '@/shared/storage/settings'
import styles from './measureDemo.module.css'

export type NudgeMode = 'off' | 'banner' | 'os'

export function nudgeModeOf(settings: Settings): NudgeMode {
  if (!settings.nudge.enabled) return 'off'
  return settings.nudge.osNotify ? 'os' : 'banner'
}

export function withNudgeMode(settings: Settings, mode: NudgeMode): Settings {
  return { ...settings, nudge: { ...settings.nudge, enabled: mode !== 'off', osNotify: mode === 'os' } }
}

const NUDGE_OPTIONS: [NudgeMode, string][] = [
  ['off', '끄기'],
  ['banner', '화면 안에서만'],
  ['os', '윈도우 알림까지'],
]
const CHECKIN_OPTIONS: [CheckinChoice, string][] = [
  ['both', '오전·오후'],
  ['morning', '오전만'],
  ['afternoon', '오후만'],
  ['off', '묻지 않기'],
]

/**
 * 기록 화면의 내 설정. 처음 설문 마지막 화면과 같은 값을 언제든 바꾼다.
 * - 기록 저장: 끄면 다음 측정부터 저장하지 않는다. 이미 저장한 기록은 아래 "지우기"로 따로 지운다.
 * - 휴식 알림: 측정 중 평소보다 높은 상태가 5분 넘게 이어질 때. 하루 2번, 90분 간격(기존 규칙).
 *   윈도우 알림을 고르면 그때 권한을 묻는다. 권한이 막혀 있으면 화면 안에서만 알린다고 보인다.
 * - 체크인 시간대.
 * - 설문 답 고치기: 저장된 답을 미리 고른 채로 설문을 다시 연다.
 */
export default function DemoSettings() {
  const { supported, permission, request } = useNotificationPermission()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [consent, setConsent] = useState<StorageConsent | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings())
    setConsent(loadConsent())
  }, [])

  const update = (next: Settings) => {
    setSettings(next)
    saveSettings(next)
  }
  const chooseNudge = async (mode: NudgeMode) => {
    if (mode === 'os' && supported && permission === 'default') await request()
    update(withNudgeMode(loadSettings(), mode))
  }
  const chooseRecord = (record: boolean) => {
    saveConsent(record)
    setConsent({ version: 1, record, decidedAt: new Date().toISOString() })
  }

  const nudgeMode = nudgeModeOf(settings)
  const checkin = checkinChoice(settings.checkinSlots)

  return (
    <div className={styles.rows} aria-label="내 설정">
      <span className={styles.careLabel}>내 설정</span>
      <SettingRow label="기록 저장">
        {([true, false] as const).map((v) => (
          <Option key={String(v)} on={consent?.record === v} onClick={() => chooseRecord(v)}>
            {v ? '저장' : '저장 안 함'}
          </Option>
        ))}
      </SettingRow>
      <SettingRow label="휴식 알림">
        {NUDGE_OPTIONS.map(([mode, label]) => (
          <Option key={mode} on={nudgeMode === mode} onClick={() => void chooseNudge(mode)}>
            {label}
          </Option>
        ))}
      </SettingRow>
      {nudgeMode === 'os' && supported && permission === 'denied' && (
        <p className={styles.notice}>윈도우 알림이 막혀 있어 화면 안에서만 알려요.</p>
      )}
      <SettingRow label="체크인">
        {CHECKIN_OPTIONS.map(([choice, label]) => (
          <Option key={choice} on={checkin === choice} onClick={() => update({ ...loadSettings(), checkinSlots: checkinSlotsFor(choice) })}>
            {label}
          </Option>
        ))}
      </SettingRow>
      <SettingRow label="설문 답">
        <Link href="/demo/survey?edit=1" className={`${styles.preset} ${styles.focusable}`} style={{ textDecoration: 'none' }}>
          다시 고치기
        </Link>
      </SettingRow>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.k}>{label}</span>
      <span className={`${styles.presets} ${styles.settingOptions}`}>{children}</span>
    </div>
  )
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`${styles.preset} ${styles.focusable} ${on ? styles.presetOn : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
