import { NextRequest, NextResponse } from 'next/server'
import { syncAllActive }             from '@/lib/ical'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // allow up to 60s for fetching multiple iCal feeds

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel's cron system
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncAllActive()
  console.log('[iCal Cron] Sync result:', JSON.stringify(result))
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...result })
}
