import { NextRequest, NextResponse } from 'next/server'
import { isAdmin }                   from '@/lib/admin-auth'
import { createAdminClient }         from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('date_overrides').select('*').order('start_date')
    return NextResponse.json({ overrides: data ?? [] })
  } catch {
    return NextResponse.json({ overrides: [] })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { start_date, end_date, nightly_rate, label } = await req.json()
  if (!start_date || !end_date || !nightly_rate)
    return NextResponse.json({ error: 'start_date, end_date, nightly_rate required' }, { status: 400 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('date_overrides')
    .insert({ start_date, end_date, nightly_rate: Number(nightly_rate), label: label || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await createAdminClient().from('date_overrides').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
