import { NextResponse } from 'next/server'
import { isAdmin }      from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Simple session health check — returns 200 if session is valid, 401 if not
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}
