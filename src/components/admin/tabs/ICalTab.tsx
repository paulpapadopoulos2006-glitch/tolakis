'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ICalSource } from '@/types'

const MY_EXPORT_URL = 'https://kaphomechios.com/api/kap-chios-ical-x9m2p7k4q8n3.ics'

const PLATFORMS = [
  {
    name:    'airbnb' as const,
    label:   'Airbnb',
    color:   '#FF5A5F',
    howToGet: [
      'Go to Airbnb → your listing',
      'Click "Availability" or "Pricing & availability"',
      'Scroll to "Availability settings" → "Sync calendars" or "Export calendar"',
      'Click "Export Calendar" → copy the link (it ends in .ics)',
      'Paste it in the field below and click Save & Sync',
    ],
    howToGive: [
      'On the same Airbnb page, click "Import Calendar"',
      'Paste YOUR export URL (yellow box above)',
      'Name it "Kap Site" → click Save',
    ],
  },
  {
    name:    'booking_com' as const,
    label:   'Booking.com',
    color:   '#003580',
    howToGet: [
      'Go to Booking.com Extranet → your property',
      'Click "Calendar" in the top menu',
      'Click "Export calendar" or find the iCal export option',
      'Copy the .ics export link',
      'Paste it in the field below and click Save & Sync',
    ],
    howToGive: [
      'On the same Booking.com calendar page, click "Import calendar"',
      'Paste YOUR export URL (yellow box above)',
      'Save the connection',
    ],
  },
]

interface SyncResult {
  success: boolean
  blockedCount?: number
  eventsFound?: number
  error?: string
}

export default function ICalTab() {
  const [sources,  setSources]  = useState<ICalSource[]>([])
  const [urls,     setUrls]     = useState<Record<string, string>>({})
  const [syncing,  setSyncing]  = useState<Record<string, boolean>>({})
  const [results,  setResults]  = useState<Record<string, SyncResult | null>>({})
  const [copied,   setCopied]   = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/ical/sources')
    const d   = await res.json()
    const srcs: ICalSource[] = d.sources ?? []
    setSources(srcs)
    const u: Record<string, string> = {}
    srcs.forEach(s => { u[s.name] = s.feed_url })
    setUrls(u)
  }, [])

  useEffect(() => { load() }, [load])

  function copyUrl() {
    navigator.clipboard.writeText(MY_EXPORT_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveAndSync(name: 'airbnb' | 'booking_com') {
    const url = urls[name]
    if (!url?.trim()) return

    setSyncing(s => ({ ...s, [name]: true }))
    setResults(r => ({ ...r, [name]: null }))

    // Step 1: Save the URL
    const saveRes = await fetch('/api/admin/ical/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ name, feed_url: url.trim() }),
    })

    if (!saveRes.ok) {
      const d = await saveRes.json()
      setResults(r => ({ ...r, [name]: { success: false, error: `Could not save URL: ${d.error}` } }))
      setSyncing(s => ({ ...s, [name]: false }))
      return
    }

    await load() // refresh sources to get the new ID

    // Step 2: Get the source ID
    const sourcesRes = await fetch('/api/admin/ical/sources')
    const sourcesData = await sourcesRes.json()
    const source = (sourcesData.sources ?? []).find((s: ICalSource) => s.name === name)

    if (!source) {
      setResults(r => ({ ...r, [name]: { success: false, error: 'Source not found after save.' } }))
      setSyncing(s => ({ ...s, [name]: false }))
      return
    }

    // Step 3: Trigger sync
    const syncRes = await fetch('/api/admin/ical/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ sourceId: source.id }),
    })
    const syncData = await syncRes.json()
    setResults(r => ({ ...r, [name]: syncData }))
    setSyncing(s => ({ ...s, [name]: false }))
    load()
  }

  async function reSyncSource(name: string, sourceId: string) {
    setSyncing(s => ({ ...s, [name]: true }))
    setResults(r => ({ ...r, [name]: null }))
    const res  = await fetch('/api/admin/ical/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ sourceId }),
    })
    const data = await res.json()
    setResults(r => ({ ...r, [name]: data }))
    setSyncing(s => ({ ...s, [name]: false }))
    load()
  }

  async function syncAll() {
    setSyncingAll(true)
    await fetch('/api/admin/ical/sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    setSyncingAll(false)
    load()
  }

  return (
    <div className="space-y-8">

      {/* ── HOW TWO-WAY SYNC WORKS ── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-white font-semibold text-sm mb-3">How two-way sync works</p>
        <div className="grid grid-cols-2 gap-4 text-xs text-white/50">
          <div>
            <p className="text-gold font-semibold mb-1">← Airbnb/Booking → Your site</p>
            <p>Paste their .ics export URL below → click Save & Sync → their blocked dates appear on your calendar and guests can't book those dates on your site.</p>
          </div>
          <div>
            <p className="text-gold font-semibold mb-1">← Your site → Airbnb/Booking</p>
            <p>Give them your export URL (yellow box) → they import it → your bookings appear on their calendar → they block those dates automatically.</p>
          </div>
        </div>
      </div>

      {/* ── YOUR EXPORT URL ── */}
      <div>
        <h2 className="font-serif text-gold text-2xl font-bold mb-1">Your Export URL</h2>
        <p className="text-white/40 text-sm mb-4">Give this to Airbnb and Booking.com so they block your direct bookings on their side.</p>
        <div className="bg-gold/10 border border-gold/25 rounded-2xl p-5">
          <div className="flex gap-2 mb-3">
            <input readOnly value={MY_EXPORT_URL}
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white/80 text-xs font-mono focus:outline-none" />
            <button onClick={copyUrl}
              className="bg-gold text-navy px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap min-w-[80px]">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-white/30 text-xs">This URL ends in .ics and is accepted by Airbnb, Booking.com and any other OTA platform.</p>
        </div>
      </div>

      {/* ── IMPORT FROM PLATFORMS ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-gold text-2xl font-bold">Import Blocked Dates</h2>
          <button onClick={syncAll} disabled={syncingAll}
            className="text-xs bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50">
            {syncingAll ? '⟳ Syncing all...' : '⟳ Re-sync All'}
          </button>
        </div>

        {PLATFORMS.map(p => {
          const source    = sources.find(s => s.name === p.name)
          const isSyncing = syncing[p.name]
          const result    = results[p.name]
          const isOpen    = expanded[p.name]

          return (
            <div key={p.name} className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="font-semibold text-white">{p.label}</span>
                {source?.last_synced && (
                  <span className="ml-auto text-white/30 text-xs">
                    Last sync: {new Date(source.last_synced).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                )}
              </div>

              {/* Instructions toggle */}
              <button onClick={() => setExpanded(e => ({ ...e, [p.name]: !isOpen }))}
                className="text-xs text-gold/70 hover:text-gold mb-4 transition-colors">
                {isOpen ? '▲ Hide instructions' : '▼ Show step-by-step instructions'}
              </button>

              {isOpen && (
                <div className="grid grid-cols-2 gap-4 mb-4 text-xs text-white/50 bg-white/3 rounded-xl p-4">
                  <div>
                    <p className="text-white/70 font-semibold mb-2">Step A — Get their URL (paste below):</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      {p.howToGet.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                  <div>
                    <p className="text-white/70 font-semibold mb-2">Step B — Give them your URL (copy above):</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      {p.howToGive.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                </div>
              )}

              {/* URL input */}
              <div className="flex gap-2 mb-3">
                <input
                  value={urls[p.name] || ''}
                  onChange={e => setUrls(u => ({ ...u, [p.name]: e.target.value }))}
                  placeholder={`Paste ${p.label} .ics export URL here...`}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-xs placeholder-white/25 focus:outline-none focus:border-gold min-w-0"
                />
                <button
                  onClick={() => saveAndSync(p.name)}
                  disabled={isSyncing || !urls[p.name]?.trim()}
                  className="bg-gold hover:bg-gold-700 disabled:bg-white/10 text-navy disabled:text-white/30 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors">
                  {isSyncing ? '⟳ Syncing...' : source ? '⟳ Save & Re-sync' : '⟳ Save & Sync'}
                </button>
                {source && !urls[p.name] && (
                  <button onClick={() => reSyncSource(p.name, source.id)} disabled={isSyncing}
                    className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs transition-colors disabled:opacity-50">
                    Re-sync
                  </button>
                )}
              </div>

              {/* Result */}
              {result && (
                <div className={`rounded-xl px-4 py-3 text-xs ${result.success ? 'bg-green-900/30 border border-green-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                  {result.success ? (
                    <p className="text-green-400">
                      ✓ Sync complete — <strong>{result.blockedCount} nights</strong> blocked from {result.eventsFound} reservation{result.eventsFound !== 1 ? 's' : ''}.
                      These dates are now blocked on your site and admin calendar.
                    </p>
                  ) : (
                    <p className="text-red-400">✗ Sync failed: {result.error}</p>
                  )}
                </div>
              )}

              {/* Last error */}
              {source?.last_error && !result && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
                  ✗ Last sync error: {source.last_error}
                </div>
              )}

              {/* Connected status */}
              {source && !source.last_error && source.last_synced && !result && (
                <p className="text-green-400/60 text-xs">✓ Connected and synced</p>
              )}

            </div>
          )
        })}
      </div>

      {/* Note about timing */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-xs text-white/30">
        <p>💡 <strong className="text-white/50">About sync timing:</strong> Your site → Airbnb/Booking.com is automatic when they pull your export URL (usually every few hours). Airbnb/Booking.com → your site requires you to click "Re-sync" or happens automatically when you open this page.</p>
      </div>

    </div>
  )
}
