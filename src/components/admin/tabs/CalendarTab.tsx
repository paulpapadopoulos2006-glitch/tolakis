'use client'
import { useState, useEffect, useCallback } from 'react'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import type { BlockedRange } from '@/types'
import { buildBlockedSet }   from '@/lib/availability'

interface BlockedDate { id: string; date: string; reason: string; notes?: string | null }

const SOURCE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  airbnb:      { bg: 'rgba(255,90,95,0.22)',  text: '#FF5A5F', label: 'Airbnb' },
  booking_com: { bg: 'rgba(0,53,128,0.35)',   text: '#60a5fa', label: 'Booking.com' },
  direct:      { bg: 'rgba(22,163,74,0.22)',  text: '#4ade80', label: 'Direct booking' },
  pending:     { bg: 'rgba(22,163,74,0.22)',  text: '#4ade80', label: 'Pending' },
  owner:       { bg: 'rgba(220,38,38,0.20)',  text: '#ef4444', label: 'Owner block' },
  maintenance: { bg: 'rgba(220,38,38,0.20)',  text: '#ef4444', label: 'Maintenance' },
}

export default function CalendarTab() {
  const [month,        setMonth]        = useState(new Date())
  const [blocked,      setBlocked]      = useState<BlockedRange[]>([])
  const [ownerBlocks,  setOwnerBlocks]  = useState<BlockedDate[]>([])
  const [adding,       setAdding]       = useState('')
  const [note,         setNote]         = useState('')
  const [saving,       setSaving]       = useState(false)
  const [blockError,   setBlockError]   = useState('')
  const [blockSuccess, setBlockSuccess] = useState('')
  const [syncing,      setSyncing]      = useState(false)
  const [syncMsg,      setSyncMsg]      = useState('')
  const [lastSync,     setLastSync]     = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [avail, admin] = await Promise.all([
        fetch('/api/availability').then(r => r.json()),
        fetch('/api/admin/blocked-dates').then(r => r.json()),
      ])
      setBlocked(avail.ranges ?? [])
      if (admin.dates) {
        setOwnerBlocks(admin.dates.filter((d: BlockedDate) =>
          d.reason === 'owner' || d.reason === 'maintenance'
        ))
      }
    } catch { /* silently retry */ }
  }, [])

  async function syncAll() {
    setSyncing(true); setSyncMsg('')
    try {
      const res  = await fetch('/api/admin/ical/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const data = await res.json()
      if (res.ok) {
        setLastSync(new Date().toLocaleTimeString())
        const total = (data.results ?? []).reduce((sum: number, r: { blockedCount?: number }) => sum + (r.blockedCount ?? 0), 0)
        setSyncMsg(`✓ Synced — ${total} dates imported from connected platforms`)
      } else {
        setSyncMsg(res.status === 401 ? '✗ Session expired — please log out and log back in' : `✗ Sync failed`)
      }
    } catch { setSyncMsg('✗ Network error during sync') }
    setSyncing(false)
    load()
  }

  // Auto-sync on mount
  useEffect(() => { load(); syncAll() }, []) // eslint-disable-line

  const blockedSet = buildBlockedSet(blocked)
  const days       = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startPad   = getDay(days[0]) === 0 ? 6 : getDay(days[0]) - 1

  function getDayStyle(key: string) {
    const entry = blocked.find(r => {
      const s = new Date(r.check_in); const e = new Date(r.check_out)
      return new Date(key) >= s && new Date(key) < e
    })
    const style = SOURCE_STYLE[entry?.source ?? ''] ?? SOURCE_STYLE.owner
    return { background: style.bg, color: style.text }
  }

  async function blockDate() {
    if (!adding) return
    setSaving(true); setBlockError(''); setBlockSuccess('')
    try {
      const res  = await fetch('/api/admin/blocked-dates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ date: adding, notes: note }),
      })
      const data = await res.json()
      if (res.ok) {
        setBlockSuccess(`✓ ${adding} is now blocked — it appears red on the main calendar`)
        setAdding(''); setNote('')
        load()
        setTimeout(() => setBlockSuccess(''), 4000)
      } else {
        setBlockError(
          res.status === 401
            ? '✗ Session expired — log out and log back in'
            : `✗ Failed to block: ${data.error ?? 'Unknown error'}`
        )
      }
    } catch (e) {
      setBlockError(`✗ Network error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
    setSaving(false)
  }

  async function unblock(id: string, date: string) {
    setBlockError(''); setBlockSuccess('')
    try {
      const res = await fetch('/api/admin/blocked-dates', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ id }),
      })
      if (res.ok) {
        setBlockSuccess(`✓ ${date} unblocked — dates are available again`)
        load()
        setTimeout(() => setBlockSuccess(''), 4000)
      } else {
        setBlockError(res.status === 401 ? '✗ Session expired' : '✗ Failed to unblock')
      }
    } catch { setBlockError('✗ Network error') }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-gold text-2xl font-bold">Availability Calendar</h2>
        <button onClick={syncAll} disabled={syncing}
          className="text-xs bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors">
          {syncing ? '⟳ Syncing...' : '⟳ Sync Platforms'}
        </button>
      </div>

      {lastSync && <p className="text-white/30 text-xs -mt-4">Last synced: {lastSync}</p>}
      {syncMsg && (
        <p className={`text-xs px-3 py-2 rounded-lg ${syncMsg.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {syncMsg}
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(SOURCE_STYLE)
          .filter(([k]) => !['pending', 'maintenance'].includes(k))
          .map(([, v]) => (
            <span key={v.label} className="flex items-center gap-1.5" style={{ color: v.text }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: v.bg, border: `1px solid ${v.text}55` }} />
              {v.label}
            </span>
          ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-4">
        <button onClick={() => setMonth(m => addDays(startOfMonth(m), -1))}
          className="text-white/40 hover:text-white text-xl px-2">‹</button>
        <span className="font-serif text-white text-lg font-semibold min-w-[160px] text-center">
          {format(month, 'MMMM yyyy')}
        </span>
        <button onClick={() => setMonth(m => addDays(endOfMonth(m), 1))}
          className="text-white/40 hover:text-white text-xl px-2">›</button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="text-white/30 text-xs py-1">{d}</div>
        ))}
        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map(day => {
          const key       = format(day, 'yyyy-MM-dd')
          const isBlocked = blockedSet.has(key)
          return (
            <div key={key}
              className="rounded-lg py-2 text-xs font-medium transition-all"
              style={isBlocked
                ? getDayStyle(key)
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }
              }>
              {format(day, 'd')}
            </div>
          )
        })}
      </div>

      {/* Block a date */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="font-semibold text-white text-sm mb-1">Block a Date Manually</p>
        <p className="text-white/30 text-xs mb-4">
          Blocked dates turn red immediately on this calendar and on the main booking page — guests cannot select them.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input type="date" value={adding} onChange={e => setAdding(e.target.value)}
            min={format(new Date(), 'yyyy-MM-dd')}
            className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-gold" />
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 min-w-32 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-gold" />
          <button onClick={blockDate} disabled={!adding || saving}
            className="bg-gold text-navy px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-50">
            {saving ? 'Blocking...' : '🔒 Block Date'}
          </button>
        </div>

        {blockError   && <p className="text-red-400 text-xs mt-3 bg-red-900/20 px-3 py-2 rounded-lg">{blockError}</p>}
        {blockSuccess && <p className="text-green-400 text-xs mt-3 bg-green-900/20 px-3 py-2 rounded-lg">{blockSuccess}</p>}
      </div>

      {/* Manually blocked list */}
      {ownerBlocks.length > 0 && (
        <div>
          <p className="font-semibold text-white text-sm mb-3">
            Manually Blocked Dates ({ownerBlocks.length})
          </p>
          <div className="space-y-2">
            {ownerBlocks.map(b => (
              <div key={b.id}
                className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <div>
                  <span className="text-red-400 text-sm font-medium">🔴 {b.date}</span>
                  {b.notes && <span className="ml-2 text-white/40 text-xs">{b.notes}</span>}
                </div>
                <button onClick={() => unblock(b.id, b.date)}
                  className="text-white/40 hover:text-white text-xs border border-white/20 hover:border-white/40 px-3 py-1 rounded-lg transition-colors">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-xs text-white/30">
        <p>💡 Blocking a date here blocks it immediately on the main booking calendar (red). Airbnb and Booking.com pick it up via your export URL within a few hours.</p>
      </div>

    </div>
  )
}
