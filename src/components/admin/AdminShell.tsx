'use client'
import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import PricingTab              from './tabs/PricingTab'
import ICalTab                 from './tabs/ICalTab'
import CalendarTab             from './tabs/CalendarTab'
import ReservationsTab         from './tabs/ReservationsTab'

const TABS = ['Pricing', 'iCal Sync', 'Calendar', 'Reservations'] as const
type Tab = typeof TABS[number]

export default function AdminShell() {
  const [active,      setActive]      = useState<Tab>('Pricing')
  const [sessionOk,   setSessionOk]   = useState<boolean | null>(null)
  const router = useRouter()

  // Verify session is still valid on mount and every 5 minutes
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/admin/me')
        setSessionOk(res.ok)
        if (!res.ok) {
          // Session expired — redirect to login after short delay
          setTimeout(() => router.push('/admin'), 2000)
        }
      } catch {
        setSessionOk(false)
      }
    }
    checkSession()
    const interval = setInterval(checkSession, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [router])

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin')
  }

  // Session expired banner
  if (sessionOk === false) {
    return (
      <div className="min-h-screen bg-[#050f1e] text-white flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-500/40 rounded-2xl p-8 text-center max-w-sm">
          <p className="text-red-400 font-semibold text-lg mb-2">Session Expired</p>
          <p className="text-white/50 text-sm mb-4">Your admin session has expired. Redirecting to login...</p>
          <button onClick={() => router.push('/admin')}
            className="bg-gold text-navy px-6 py-2 rounded-xl font-bold text-sm">
            Log In Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050f1e] text-white">
      <div className="bg-white/5 border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-serif text-gold text-xl font-bold">K A P · Admin</p>
          <p className="text-white/40 text-xs mt-0.5">kaphomechios.com</p>
        </div>
        <div className="flex items-center gap-3">
          {sessionOk === true && (
            <span className="flex items-center gap-1.5 text-green-400/60 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Session active
            </span>
          )}
          <button onClick={logout}
            className="text-xs text-white/40 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg transition-colors">
            Logout
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-6 flex gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActive(tab)}
            className={`py-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              active === tab ? 'border-gold text-gold' : 'border-transparent text-white/40 hover:text-white'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {active === 'Pricing'      && <PricingTab />}
        {active === 'iCal Sync'    && <ICalTab />}
        {active === 'Calendar'     && <CalendarTab />}
        {active === 'Reservations' && <ReservationsTab />}
      </div>
    </div>
  )
}
