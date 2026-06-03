'use client'
import { useState, useEffect, useCallback } from 'react'
import type { DateOverride } from '@/types'

export default function PricingTab() {
  const [baseRate,  setBaseRate]  = useState('')
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [saved,     setSaved]     = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [dbReady,   setDbReady]   = useState(true)

  const [oStart,  setOStart]  = useState('')
  const [oEnd,    setOEnd]    = useState('')
  const [oRate,   setORate]   = useState('')
  const [oLabel,  setOLabel]  = useState('')
  const [oSaving, setOSaving] = useState(false)
  const [oError,  setOError]  = useState('')
  const [oSaved,  setOSaved]  = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pricing')
      const d   = await res.json()
      setBaseRate(String(d.config?.nightly_rate ?? 90))
      setOverrides(d.overrides ?? [])
      // If overrides returned as empty array with no error, table likely exists
    } catch {
      setError('Could not load pricing data.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveBase() {
    setLoading(true); setError(''); setSaved(false)
    try {
      const res  = await fetch('/api/admin/pricing', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ nightly_rate: Number(baseRate) }),
      })
      const data = await res.json()
      if (res.ok) { setSaved(true); load() }
      else setError(`Failed: ${data.error ?? 'Unknown error'}`)
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally { setLoading(false) }
  }

  async function addOverride() {
    if (!oStart || !oEnd || !oRate) return
    setOSaving(true); setOError(''); setOSaved(false)
    try {
      const res  = await fetch('/api/admin/pricing/overrides', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ start_date: oStart, end_date: oEnd, nightly_rate: Number(oRate), label: oLabel }),
      })
      const data = await res.json()
      if (res.ok) {
        setOStart(''); setOEnd(''); setORate(''); setOLabel('')
        setOSaved(true)
        setTimeout(() => setOSaved(false), 3000)
        load()
      } else {
        if (data.error?.includes('does not exist') || data.error?.includes('relation')) {
          setDbReady(false)
          setOError('❌ The date_overrides table does not exist in Supabase. Run the SQL migration first (see instructions below).')
        } else {
          setOError(`Failed to save: ${data.error ?? 'Unknown error'}`)
        }
      }
    } catch (e) {
      setOError(`Network error: ${e instanceof Error ? e.message : 'unknown'}`)
    } finally { setOSaving(false) }
  }

  async function deleteOverride(id: string) {
    await fetch('/api/admin/pricing/overrides', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="space-y-8">

      {/* Base Rate */}
      <div>
        <h2 className="font-serif text-gold text-2xl font-bold mb-1">Base Nightly Rate</h2>
        <p className="text-white/40 text-sm mb-4">Default rate when no date override applies.</p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <label className="block text-xs uppercase tracking-widest text-white/50 mb-3">Rate per night (€ EUR)</label>
          <div className="flex items-center gap-3">
            <span className="text-3xl text-white/30 font-serif">€</span>
            <input type="number" value={baseRate} onChange={e => setBaseRate(e.target.value)}
              min="1" max="9999" step="1"
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-3xl font-serif w-36 text-center focus:outline-none focus:border-gold" />
            <span className="text-white/30 text-sm">/ night</span>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          {saved && <p className="text-green-400 text-sm mt-3">✓ Rate saved — customers will see €{baseRate}/night on next page load</p>}
          <button onClick={saveBase} disabled={loading || !baseRate}
            className="mt-5 bg-gold hover:bg-gold-700 disabled:bg-white/10 text-navy disabled:text-white/30 px-8 py-3 rounded-xl font-bold transition-colors">
            {loading ? 'Saving...' : '💾 Save Rate'}
          </button>
        </div>
      </div>

      {/* SQL Migration Warning */}
      {!dbReady && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-5">
          <p className="text-red-400 font-semibold text-sm mb-2">⚠️ Missing database table</p>
          <p className="text-white/60 text-xs mb-3">Run this SQL in Supabase → SQL Editor to enable custom date pricing:</p>
          <pre className="bg-black/40 rounded-xl p-3 text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS date_overrides (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  nightly_rate NUMERIC(10,2) NOT NULL,
  label        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);
ALTER TABLE date_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_overrides" ON date_overrides FOR SELECT USING (true);`}</pre>
        </div>
      )}

      {/* Date Overrides */}
      <div>
        <h2 className="font-serif text-gold text-2xl font-bold mb-1">Custom Date Pricing</h2>
        <p className="text-white/40 text-sm mb-4">Set higher or lower rates for specific date ranges. Changes reflect instantly for any customer who loads the page after you save.</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <p className="text-white font-semibold text-sm mb-4">Add a Date Range Override</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">From</label>
              <input type="date" value={oStart} onChange={e => setOStart(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">To</label>
              <input type="date" value={oEnd} onChange={e => setOEnd(e.target.value)} min={oStart}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Rate (€/night)</label>
              <input type="number" value={oRate} onChange={e => setORate(e.target.value)}
                placeholder="e.g. 120" min="1"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Label (optional)</label>
              <input type="text" value={oLabel} onChange={e => setOLabel(e.target.value)}
                placeholder="e.g. Summer peak"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gold" />
            </div>
          </div>

          {oError && <p className="text-red-400 text-xs mb-3">{oError}</p>}
          {oSaved && <p className="text-green-400 text-xs mb-3">✓ Override saved — customers will see the new price for these dates</p>}

          <button onClick={addOverride} disabled={oSaving || !oStart || !oEnd || !oRate}
            className="bg-gold hover:bg-gold-700 disabled:bg-white/10 text-navy disabled:text-white/30 px-6 py-2.5 rounded-xl font-bold text-sm transition-colors">
            {oSaving ? 'Saving...' : '+ Add Override'}
          </button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-6">No date overrides yet. Base rate applies to all dates.</p>
        ) : (
          <div className="space-y-2">
            {overrides.map(o => (
              <div key={o.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm font-medium">{o.start_date} → {o.end_date}</span>
                    {o.label && <span className="ml-2 text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{o.label}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gold font-serif text-lg">€{o.nightly_rate}<span className="text-xs text-white/30 font-sans ml-1">/night</span></span>
                    <button onClick={() => deleteOverride(o.id)}
                      className="text-red-400/60 hover:text-red-400 text-xs transition-colors">✕ Delete</button>
                  </div>
                </div>
                <p className="text-white/25 text-xs mt-1">
                  Added: {new Date(o.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
