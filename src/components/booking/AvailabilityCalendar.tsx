'use client'
import { DayPicker, type Matcher } from 'react-day-picker'
import { buildBlockedSet }         from '@/lib/availability'
import { startOfDay }              from 'date-fns'
import type { DateRange, BlockedRange } from '@/types'

interface Props {
  blockedRanges: BlockedRange[]
  selected:      DateRange
  onSelect:      (range: DateRange) => void
}

export default function AvailabilityCalendar({ blockedRanges, selected, onSelect }: Props) {
  const blockedSet = buildBlockedSet(blockedRanges)
  const today      = startOfDay(new Date())

  const isBlocked: Matcher = (date: Date): boolean => {
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
    return blockedSet.has(key)
  }

  return (
    <DayPicker
      mode="range"
      selected={{ from: selected.from, to: selected.to }}
      onSelect={r => onSelect({ from: r?.from, to: r?.to })}
      disabled={[{ before: today }, isBlocked]}
      modifiers={{ blocked: isBlocked }}
      modifiersStyles={{
        blocked: {
          backgroundColor: 'rgba(220,38,38,0.12)',
          color:           '#dc2626',
          fontWeight:      '600',
          textDecoration:  'line-through',
          opacity:         1,
          cursor:          'not-allowed',
        },
      }}
      numberOfMonths={1}
      showOutsideDays={false}
    />
  )
}
