import { describe, expect, it } from 'vitest'
import { createWaveLog, logBox, logBvp, logMarker, waveLogToJson, WAVE_LOG_MAX } from '@/features/rppg/lib/waveLog'

describe('실험실 파형 기록', () => {
  it('시각을 측정 시작 기준으로 바꿔 내보내고, 시작 전 워치 값은 뺀다', () => {
    const log = createWaveLog(1000)
    logBvp(log, 'me', 1033.34, 0.5)
    logBvp(log, 'me', 1066, Number.NaN)
    logBox(log, 1033.34, 320, 240, 100)
    logMarker(log, 2000, 'condition:quiet')
    const out = JSON.parse(
      waveLogToJson(log, [
        { t: 500, bpm: 70, contact: 'good' },
        { t: 1500, bpm: 72, contact: 'good' },
      ]),
    )
    expect(out.format).toBe('onmaum-rppg-wave')
    expect(Object.keys(out.models)).toEqual(['me'])
    expect(out.models.me).toEqual({ t: [33.3], v: [0.5] })
    expect(out.box.cx).toEqual([320])
    expect(out.watch).toEqual([{ t: 500, bpm: 72, contact: 'good' }])
    expect(out.markers).toEqual([{ t: 1000, label: 'condition:quiet' }])
  })

  it('최대 개수를 넘으면 더 받지 않는다', () => {
    const log = createWaveLog(0)
    for (let i = 0; i < WAVE_LOG_MAX + 5; i++) logBvp(log, 'me', i, 1)
    expect(log.models.me.t.length).toBe(WAVE_LOG_MAX)
  })
})
