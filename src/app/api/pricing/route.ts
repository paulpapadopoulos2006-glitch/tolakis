import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data: config } = await supabase.from('pricing_config').select('key, value')
    const configMap = Object.fromEntries(
      (config ?? []).map((r: { key: string; value: number }) => [r.key, Number(r.value)])
    )
    // date_overrides may not exist yet if migration hasn't been run
    let overrides: unknown[] = []
    try {
      const { data } = await supabase.from('date_overrides').select('*').order('start_date')
      overrides = data ?? []
    } catch { /* table not yet created */ }
    return NextResponse.json({ config: configMap, overrides })
  } catch {
    return NextResponse.json({ config: { nightly_rate: 90, max_guests: 4 }, overrides: [] })
  }
}
