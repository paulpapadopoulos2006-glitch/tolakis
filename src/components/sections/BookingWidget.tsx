'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter }                    from 'next/navigation'
import { differenceInCalendarDays, format, eachDayOfInterval, addDays } from 'date-fns'
import { motion, AnimatePresence }      from 'framer-motion'
import { PROPERTY }                     from '@/constants/property'
import { formatEur }                    from '@/lib/pricing'
import AvailabilityCalendar             from '@/components/booking/AvailabilityCalendar'
import type { DateRange, BlockedRange, DateOverride, PriceBreakdown } from '@/types'

interface Props { blockedRanges: BlockedRange[]; initialRate?: number }

function calcPrice(from: Date, to: Date, baseRate: number, overrides: DateOverride[]) {
  const nights = eachDayOfInterval({ start: from, end: addDays(to, -1) })
  const segments: PriceBreakdown[] = []
  for (const night of nights) {
    const d = format(night, 'yyyy-MM-dd')
    const ov = overrides.find(o => d >= o.start_date && d <= o.end_date)
    const r  = ov ? Number(ov.nightly_rate) : baseRate
    const l  = ov?.label ?? null
    const last = segments[segments.length - 1]
    if (last && last.rate === r && last.label === l) last.nights++
    else segments.push({ rate: r, nights: 1, label: l })
  }
  const total = segments.reduce((s, b) => s + b.rate * b.nights, 0)
  return { total, segments }
}

export default function BookingWidget({ blockedRanges: serverRanges, initialRate = 90 }: Props) {
  const router = useRouter()
  const [range,     setRange]     = useState<DateRange>({ from: undefined, to: undefined })
  const [guests,    setGuests]    = useState(2)
  const [baseRate,  setBaseRate]  = useState<number>(initialRate)
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [showCal,   setShowCal]   = useState(false)
  // Live blocked ranges — start with server-side SSR data, refresh client-side on mount
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>(serverRanges)

  useEffect(() => {
    // Fetch fresh pricing + availability on every page load
    fetch('/api/pricing').then(r => r.json()).then(d => {
      setBaseRate(d.config?.nightly_rate ?? 90)
      setOverrides(d.overrides ?? [])
    }).catch(() => {})
    fetch('/api/availability').then(r => r.json()).then(d => {
      setBlockedRanges(d.ranges ?? [])
    }).catch(() => {})
  }, [])

  const nights = range.from && range.to ? differenceInCalendarDays(range.to, range.from) : 0
  const pricing = useMemo(() => {
    if (!range.from || !range.to || nights < 1) return null
    return calcPrice(range.from, range.to, baseRate, overrides)
  }, [range, baseRate, overrides, nights])
  const total  = pricing?.total ?? null
  const ready  = !!range.from && !!range.to && nights > 0

  function handleReserve() {
    if (!ready || !total) return
    const p = new URLSearchParams({
      checkin:  format(range.from!, 'yyyy-MM-dd'),
      checkout: format(range.to!,   'yyyy-MM-dd'),
      guests:   guests.toString(),
      total:    total.toString(),
      rate:     baseRate.toString(),
    })
    router.push(`/booking?${p}`)
  }

  return (
    <div style={{
      background: 'rgba(253,250,246,0.96)',
      backdropFilter: 'blur(20px)',
      borderRadius: '1.5rem',
      border: '1px solid rgba(193,120,91,0.12)',
      boxShadow: '0 24px 64px rgba(44,36,32,0.18), 0 4px 16px rgba(44,36,32,0.08)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{ padding: '1.6rem 1.6rem 0' }}>
        <div className="flex items-baseline justify-between mb-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif" style={{ fontSize: '2.2rem', fontWeight: 300, color: '#2c2420', letterSpacing: '-0.01em' }}>
              {formatEur(baseRate)}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#8c7e78', fontWeight: 300 }}>/ night</span>
          </div>
          <div className="flex items-center gap-1" style={{ color: '#c1785b' }}>
            <span style={{ fontSize: '0.75rem' }}>★</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 400, color: '#5c4f48' }}>{PROPERTY.stats.rating}</span>
            <span style={{ fontSize: '0.75rem', color: '#8c7e78', fontWeight: 300 }}>({PROPERTY.stats.reviewCount})</span>
          </div>
        </div>
        <div style={{ width: '2rem', height: '1px', background: 'rgba(193,120,91,0.3)', marginBottom: '1.4rem' }} />
      </div>

      {/* Dates */}
      <div style={{ padding: '0 1.6rem' }}>
        <button
          onClick={() => setShowCal(!showCal)}
          className="w-full text-left transition-all duration-200"
          style={{
            border: `1px solid ${showCal ? 'rgba(193,120,91,0.5)' : 'rgba(193,120,91,0.15)'}`,
            borderRadius: '0.875rem',
            marginBottom: '0.625rem',
            overflow: 'hidden',
            background: showCal ? 'rgba(193,120,91,0.03)' : 'transparent',
          }}
        >
          <div className="grid grid-cols-2">
            <div style={{ padding: '0.875rem 1rem', borderRight: '1px solid rgba(193,120,91,0.15)' }}>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c1785b', fontWeight: 500, marginBottom: '0.3rem' }}>Check-in</p>
              <p style={{ fontSize: '0.875rem', color: range.from ? '#2c2420' : '#b0a49e', fontWeight: 300 }}>
                {range.from ? format(range.from, 'dd MMM yyyy') : 'Add date'}
              </p>
            </div>
            <div style={{ padding: '0.875rem 1rem' }}>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c1785b', fontWeight: 500, marginBottom: '0.3rem' }}>Check-out</p>
              <p style={{ fontSize: '0.875rem', color: range.to ? '#2c2420' : '#b0a49e', fontWeight: 300 }}>
                {range.to ? format(range.to, 'dd MMM yyyy') : 'Add date'}
              </p>
            </div>
          </div>
        </button>

        <AnimatePresence>
          {showCal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden', marginBottom: '0.625rem' }}
            >
              <AvailabilityCalendar
                blockedRanges={blockedRanges}
                selected={range}
                onSelect={r => { setRange(r); if (r.from && r.to) setShowCal(false) }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guests */}
        <div style={{
          border: '1px solid rgba(193,120,91,0.15)',
          borderRadius: '0.875rem',
          padding: '0.875rem 1rem',
          marginBottom: '1.2rem',
        }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c1785b', fontWeight: 500, marginBottom: '0.25rem' }}>Guests</p>
              <p style={{ fontSize: '0.8rem', color: '#8c7e78', fontWeight: 300 }}>Max {PROPERTY.stats.maxGuests}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGuests(Math.max(1, guests - 1))}
                disabled={guests <= 1}
                style={{
                  width: '2rem', height: '2rem', borderRadius: '50%',
                  border: '1px solid rgba(193,120,91,0.25)',
                  color: guests <= 1 ? '#c4b8b2' : '#2c2420',
                  background: 'transparent', cursor: guests <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >−</button>
              <span style={{ fontSize: '0.95rem', color: '#2c2420', fontWeight: 400, minWidth: '1rem', textAlign: 'center' }}>{guests}</span>
              <button
                onClick={() => setGuests(Math.min(PROPERTY.stats.maxGuests, guests + 1))}
                disabled={guests >= PROPERTY.stats.maxGuests}
                style={{
                  width: '2rem', height: '2rem', borderRadius: '50%',
                  border: '1px solid rgba(193,120,91,0.25)',
                  color: guests >= PROPERTY.stats.maxGuests ? '#c4b8b2' : '#2c2420',
                  background: 'transparent', cursor: guests >= PROPERTY.stats.maxGuests ? 'not-allowed' : 'pointer',
                  fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      <AnimatePresence>
        {pricing && total && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ padding: '0 1.6rem', marginBottom: '1rem', overflow: 'hidden' }}
          >
            <div style={{ background: 'rgba(193,120,91,0.05)', borderRadius: '0.75rem', padding: '0.875rem 1rem' }}>
              {pricing.segments.map((seg, i) => (
                <div key={i} className="flex justify-between" style={{ fontSize: '0.8rem', color: '#5c4f48', fontWeight: 300, marginBottom: '0.35rem' }}>
                  <span>{formatEur(seg.rate)} × {seg.nights} night{seg.nights > 1 ? 's' : ''}{seg.label ? ` (${seg.label})` : ''}</span>
                  <span>{formatEur(seg.rate * seg.nights)}</span>
                </div>
              ))}
              <div className="flex justify-between" style={{ borderTop: '1px solid rgba(193,120,91,0.12)', paddingTop: '0.5rem', marginTop: '0.35rem', fontSize: '0.875rem', color: '#2c2420', fontWeight: 500 }}>
                <span>Total</span>
                <span>{formatEur(total)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA */}
      <div style={{ padding: '0 1.6rem 1.6rem' }}>
        <button
          onClick={handleReserve}
          disabled={!ready}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '0.875rem',
            border: 'none',
            background: ready ? '#c1785b' : 'rgba(193,120,91,0.12)',
            color: ready ? '#fff' : '#b0a49e',
            fontSize: '0.875rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
            cursor: ready ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {ready ? `Reserve — ${formatEur(total!)}` : 'Check Availability'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#a09590', fontWeight: 300, marginTop: '0.75rem', letterSpacing: '0.04em' }}>
          No fees · No service charge · Best price
        </p>
      </div>

    </div>
  )
}
