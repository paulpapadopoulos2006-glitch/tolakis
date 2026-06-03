const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM           = 'KAP Home <bookings@kaphomechios.com>'
const OWNER_EMAIL    = 'paulpapadopoulos2006@gmail.com'

async function send(to: string | string[], subject: string, html: string) {
  if (!RESEND_API_KEY) { console.warn('RESEND_API_KEY not set — email skipped'); return }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) console.error('Resend error:', await res.text())
}

export async function sendOwnerAlert(r: {
  guest_name:  string
  guest_email: string
  guest_phone?: string | null
  check_in:    string
  check_out:   string
  num_nights:  number
  num_guests:  number
  total_amount: number
}) {
  await send(
    OWNER_EMAIL,
    `🏠 New Booking — ${r.guest_name} · ${r.check_in}`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#2c2420">
      <h2 style="color:#c1785b;margin-bottom:4px">New Direct Booking</h2>
      <p style="color:#8c7e78;margin-top:0">KAP Home Chios</p>
      <table style="width:100%;border-collapse:collapse;margin-top:24px">
        <tr><td style="padding:8px 0;color:#8c7e78;width:140px">Guest</td><td style="padding:8px 0;font-weight:500">${r.guest_name}</td></tr>
        <tr><td style="padding:8px 0;color:#8c7e78">Email</td><td style="padding:8px 0">${r.guest_email}</td></tr>
        ${r.guest_phone ? `<tr><td style="padding:8px 0;color:#8c7e78">Phone</td><td style="padding:8px 0">${r.guest_phone}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#8c7e78">Check-in</td><td style="padding:8px 0;font-weight:500">${r.check_in}</td></tr>
        <tr><td style="padding:8px 0;color:#8c7e78">Check-out</td><td style="padding:8px 0;font-weight:500">${r.check_out}</td></tr>
        <tr><td style="padding:8px 0;color:#8c7e78">Nights</td><td style="padding:8px 0">${r.num_nights}</td></tr>
        <tr><td style="padding:8px 0;color:#8c7e78">Guests</td><td style="padding:8px 0">${r.num_guests}</td></tr>
        <tr style="border-top:2px solid #f5efe6"><td style="padding:12px 0;font-weight:700;font-size:1.1em">Total</td><td style="padding:12px 0;font-weight:700;font-size:1.1em;color:#c1785b">€${r.total_amount}</td></tr>
      </table>
      <p style="margin-top:24px;padding:12px 16px;background:#f5efe6;border-radius:8px;font-size:0.85em;color:#5c4f48">
        Payment confirmed via Stripe. Dates are now blocked on the booking calendar.
      </p>
    </div>
    `
  )
}

export async function sendGuestConfirmation(r: {
  guest_name:  string
  guest_email: string
  check_in:    string
  check_out:   string
  num_nights:  number
  num_guests:  number
  total_amount: number
}) {
  await send(
    r.guest_email,
    `Booking Confirmed — KAP Home Chios ✓`,
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#2c2420">
      <h2 style="color:#c1785b">Your booking is confirmed!</h2>
      <p>Dear ${r.guest_name},</p>
      <p>Thank you for booking KAP Home Chios directly. We look forward to hosting you.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:24px">
        <tr><td style="padding:8px 0;color:#8c7e78;width:140px">Check-in</td><td style="padding:8px 0;font-weight:500">${r.check_in}</td></tr>
        <tr><td style="padding:8px 0;color:#8c7e78">Check-out</td><td style="padding:8px 0;font-weight:500">${r.check_out}</td></tr>
        <tr><td style="padding:8px 0;color:#8c7e78">Nights</td><td style="padding:8px 0">${r.num_nights}</td></tr>
        <tr><td style="padding:8px 0;color:#8c7e78">Guests</td><td style="padding:8px 0">${r.num_guests}</td></tr>
        <tr style="border-top:2px solid #f5efe6"><td style="padding:12px 0;font-weight:700">Total paid</td><td style="padding:12px 0;font-weight:700;color:#c1785b">€${r.total_amount}</td></tr>
      </table>
      <p style="margin-top:24px">Questions? WhatsApp us at <a href="https://wa.me/306948078882" style="color:#c1785b">+30 694 807 8882</a></p>
      <p style="color:#8c7e78;font-size:0.85em">KAP Home · Chios Town Centre, Chios Island, Greece</p>
    </div>
    `
  )
}
