import { NextResponse }       from 'next/server'
import { isAdmin }            from '@/lib/admin-auth'
import { createAdminClient }  from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Decode the "role" claim from a Supabase JWT key (anon vs service_role)
function decodeKeyRole(key: string | undefined): string {
  if (!key) return 'MISSING'
  try {
    const payload = key.split('.')[1]
    const json    = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    return json.role ?? 'unknown'
  } catch {
    return 'NOT_A_VALID_JWT'
  }
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  const report = {
    url_value:           url || 'MISSING',
    url_has_trailing_issue: url !== url.trim() || url.endsWith('/'),
    anon_key_role:       decodeKeyRole(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    service_key_role:    decodeKeyRole(process.env.SUPABASE_SERVICE_ROLE_KEY),
    write_test:          'not run',
    write_error:         '',
  }

  // CRITICAL: service_key_role MUST say "service_role". If it says "anon", that's the bug.

  // Real write test — write a temp value and read it back
  try {
    const supabase = createAdminClient()
    const testVal  = Math.floor(Math.random() * 1000)
    await supabase.from('pricing_config').upsert(
      { key: '__debug_test', value: testVal, description: 'debug', updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    const { data } = await supabase.from('pricing_config').select('value').eq('key', '__debug_test').single()
    const readBack = data?.value != null ? Number(data.value) : null
    report.write_test = readBack === testVal
      ? '✅ WRITE WORKS — wrote and read back ' + testVal
      : `❌ WRITE FAILED SILENTLY — wrote ${testVal} but read back ${readBack}. This means RLS is blocking writes (wrong service_role key).`
    // cleanup
    await supabase.from('pricing_config').delete().eq('key', '__debug_test')
  } catch (e) {
    report.write_error = e instanceof Error ? e.message : 'unknown'
  }

  return NextResponse.json(report, { status: 200 })
}
