import { NextRequest, NextResponse }         from 'next/server'
import { createAdminClient }                 from '@/lib/supabase/server'
import { createCheckoutSession }             from '@/lib/stripe'
import { isRangeAvailable, buildBlockedSet } from '@/lib/availability'
import { parseISO, eachDayOfInterval, addDays, format } from 'date-fns'
import type { ReservationInsert, BlockedRange, DateOverride } from '@/types'

export const dynamic = 'force-dynamic'

function serverCalcTotal(checkIn: string, checkOut: string, baseRate: number, overrides: DateOverride[]): { total: number; numNights: number } {
  const days = eachDayOfInterval({ start: parseISO(checkIn), end: addDays(parseISO(checkOut), -1) })
  const total = days.reduce((sum, day) => {
    const d  = format(day, 'yyyy-MM-dd')
    const ov = overrides.find(o => d >= o.start_date && d <= o.end_date)
    return sum + (ov ? Number(ov.nightly_rate) : baseRate)
  }, 0)
  return { total, numNights: days.length }
}

export async function POST(req: NextRequest) {
  try {
    const {
      checkIn, checkOut, numGuests,
      guestName, guestEmail, guestPhone, specialRequests,
    } = await req.json()

    const supabase = createAdminClient()

    // 1. Check availability
    const { data: ranges } = await supabase.from('booked_ranges').select('check_in, check_out')
    const blocked = buildBlockedSet((ranges ?? []) as BlockedRange[])
    if (!isRangeAvailable(parseISO(checkIn), parseISO(checkOut), blocked)) {
      return NextResponse.json(
        { error: 'Sorry — those dates were just taken. Please choose different dates.' },
        { status: 409 },
      )
    }

    // 2. Calculate price SERVER-SIDE from the database (prevents manipulation)
    const { data: config } = await supabase.from('pricing_config').select('key, value')
    const configMap = Object.fromEntries((config ?? []).map((r: { key: string; value: number }) => [r.key, Number(r.value)]))
    const baseRate  = configMap.nightly_rate ?? 90

    // date_overrides table may not exist yet — fall back to base rate only
    let overrides: DateOverride[] = []
    try {
      const { data } = await supabase.from('date_overrides').select('*').order('start_date')
      overrides = (data ?? []) as DateOverride[]
    } catch { /* table not created yet — use base rate */ }
    const { total, numNights } = serverCalcTotal(checkIn, checkOut, baseRate, overrides)

    if (numNights < 1) return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })

    // 3. Insert reservation with server-calculated total
    const reservation: ReservationInsert = {
      guest_name:       guestName,
      guest_email:      guestEmail,
      guest_phone:      guestPhone || null,
      check_in:         checkIn,
      check_out:        checkOut,
      num_guests:       numGuests,
      nightly_rate:     baseRate,
      total_amount:     total,
      currency:         'EUR',
      status:           'pending',
      payment_status:   'pending',
      booking_source:   'direct',
      special_requests: specialRequests || null,
    }

    const { data: created, error: insertError } = await supabase
      .from('reservations').insert(reservation).select('id').single()
    if (insertError || !created) throw new Error(insertError?.message ?? 'Insert failed')

    // 4. Create Stripe session with server-calculated total
    const session = await createCheckoutSession({
      reservationId: created.id,
      nightlyRate:   baseRate,
      numNights,
      totalAmount:   total,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
    })

    await supabase.from('reservations').update({ stripe_session_id: session.id }).eq('id', created.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
