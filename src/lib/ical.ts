import * as ical from 'node-ical'
import { eachDayOfInterval, format, startOfDay, isBefore } from 'date-fns'
import { createAdminClient } from '@/lib/supabase/server'

export async function syncICalSource(
  sourceId:   string,
  feedUrl:    string,
  sourceName: 'airbnb' | 'booking_com',
): Promise<{ success: boolean; blockedCount?: number; eventsFound?: number; error?: string }> {
  const supabase = createAdminClient()
  try {
    // Use fetch with a proper browser-like User-Agent so Airbnb/Booking.com don't reject it
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalendarBot/1.0)',
        'Accept':     'text/calendar, */*',
      },
      // 15 second timeout
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`Could not fetch calendar: HTTP ${response.status} ${response.statusText}`)
    }

    const icsText = await response.text()
    if (!icsText.includes('BEGIN:VCALENDAR')) {
      throw new Error('Response is not a valid iCal file. Check the URL is an .ics export link.')
    }

    // Parse the iCal data synchronously
    const events = ical.sync.parseICS(icsText)
    const rows: { date: string; reason: string; source_uid: string }[] = []
    let eventsFound = 0

    for (const key in events) {
      const event = events[key]
      if (event.type !== 'VEVENT') continue
      if (!event.start || !event.end)  continue
      eventsFound++

      const start     = startOfDay(new Date(event.start as Date))
      const checkoutD = startOfDay(new Date(event.end   as Date))
      // iCal DTEND is the checkout day (exclusive) — last night is day before checkout
      const lastNight = new Date(checkoutD.getTime() - 86_400_000)

      if (isBefore(lastNight, start)) continue

      eachDayOfInterval({ start, end: lastNight }).forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        rows.push({
          date:       dateStr,
          reason:     sourceName,
          source_uid: `${sourceName}-${event.uid || key}-${dateStr}`,
        })
      })
    }

    // Delete all previous blocks for this specific source
    const { error: delError } = await supabase
      .from('blocked_dates')
      .delete()
      .eq('reason', sourceName)

    if (delError) throw new Error(`Could not clear old blocks: ${delError.message}`)

    // Insert fresh blocks — upsert on (date, reason) so we don't conflict with owner blocks
    if (rows.length > 0) {
      const { error: insError } = await supabase
        .from('blocked_dates')
        .upsert(rows, { onConflict: 'date,reason' })
      if (insError) throw new Error(`Could not save blocks: ${insError.message}`)
    }

    // Update last_synced timestamp and clear any previous error
    await supabase
      .from('ical_sources')
      .update({ last_synced: new Date().toISOString(), last_error: null })
      .eq('id', sourceId)

    return { success: true, blockedCount: rows.length, eventsFound }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    // Record the error in the database so admin can see it
    await supabase
      .from('ical_sources')
      .update({ last_error: msg })
      .eq('id', sourceId)
    return { success: false, error: msg }
  }
}

export async function syncAllActive() {
  const supabase = createAdminClient()
  const { data: sources } = await supabase
    .from('ical_sources')
    .select('*')
    .eq('is_active', true)

  if (!sources?.length) return { synced: 0, results: [], message: 'No iCal sources configured yet.' }

  const results = await Promise.all(
    sources.map(s => syncICalSource(s.id, s.feed_url, s.name as 'airbnb' | 'booking_com')),
  )
  return { synced: sources.length, results }
}
