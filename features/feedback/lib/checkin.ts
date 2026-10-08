export type CheckinSlot = 'morning' | 'afternoon'
export interface CheckinWindow {
  startHour: number
  endHour: number
}

export function currentSlot(
  now: Date,
  morning: CheckinWindow,
  afternoon: CheckinWindow,
): CheckinSlot | null {
  const h = now.getHours()
  if (h >= morning.startHour && h < morning.endHour) return 'morning'
  if (h >= afternoon.startHour && h < afternoon.endHour) return 'afternoon'
  return null
}

export function checkinDue(args: {
  now: Date
  morning: CheckinWindow
  afternoon: CheckinWindow
  doneSlots: CheckinSlot[]
  hasTodayData: boolean
}): { due: boolean; slot: CheckinSlot | null } {
  const slot = currentSlot(args.now, args.morning, args.afternoon)
  if (!slot || !args.hasTodayData || args.doneSlots.includes(slot)) {
    return { due: false, slot }
  }
  return { due: true, slot }
}
