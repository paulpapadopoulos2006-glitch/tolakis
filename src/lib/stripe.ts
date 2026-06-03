import Stripe from 'stripe'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key)
}

// Lazy proxy so module-level import doesn't crash at build time
export const stripe = new Proxy({} as Stripe, {
  get: (_target, prop) => {
    const client = getStripe()
    const val = (client as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? val.bind(client) : val
  },
})

export async function createCheckoutSession({
  reservationId, nightlyRate, numNights, totalAmount,
  checkIn, checkOut, guestName, guestEmail,
}: {
  reservationId: string
  nightlyRate:   number
  numNights:     number
  totalAmount:   number
  checkIn:       string
  checkOut:      string
  guestName:     string
  guestEmail:    string
}) {
  const client  = getStripe()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kaphomechios.com'

  return client.checkout.sessions.create({
    payment_method_types: ['card'],
    mode:                 'payment',
    customer_email:       guestEmail,
    line_items: [{
      price_data: {
        currency:     'eur',
        unit_amount:  Math.round(totalAmount * 100),
        product_data: {
          name:        `KAP Home Chios — ${numNights} night${numNights > 1 ? 's' : ''}`,
          description: `Check-in: ${checkIn} · Check-out: ${checkOut}`,
          images:      [`${siteUrl}/images/hero-main.jpg`],
        },
      },
      quantity: 1,
    }],
    metadata: {
      reservation_id: reservationId,
      check_in:       checkIn,
      check_out:      checkOut,
      guest_name:     guestName,
    },
    success_url: `${siteUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${siteUrl}/booking?cancelled=true`,
    expires_at:  Math.floor(Date.now() / 1000) + 30 * 60,
  })
}
