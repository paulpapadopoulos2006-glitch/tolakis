import { NextRequest, NextResponse } from 'next/server'
import { isAdmin }                   from '@/lib/admin-auth'
import { createAdminClient }         from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized — please log in again' }, { status: 401 })

  const { nightly_rate } = await req.json()
  const rate = Number(nightly_rate)
  if (isNaN(rate) || rate < 1 || rate > 9999)
    return NextResponse.json({ error: 'Invalid rate — must be between 1 and 9999' }, { status: 400 })

  const supabase = createAdminClient()

  // upsert so it works even if the row doesn't exist yet
  const { error } = await supabase
    .from('pricing_config')
    .upsert(
      { key: 'nightly_rate', value: rate, description: 'Nightly rate in EUR', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, nightly_rate: rate })
}
