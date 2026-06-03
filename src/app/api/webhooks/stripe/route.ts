import { NextRequest, NextResponse }          from 'next/server'
import { stripe }                             from '@/lib/stripe'
import { createAdminClient }                  from '@/lib/supabase/server'
import { sendOwnerAlert, sendGuestConfirmation } from '@/lib/email'
import type Stripe                            from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET ?? '')
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Webhook error' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session     = event.data.object as Stripe.Checkout.Session
    const paymentIntent = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

    // Update reservation status
    const { data: reservation } = await supabase
      .from('reservations')
      .update({ status: 'confirmed', payment_status: 'paid', stripe_payment_intent_id: paymentIntent })
      .eq('stripe_session_id', session.id)
      .select('guest_name, guest_email, guest_phone, check_in, check_out, num_nights, num_guests, total_amount')
      .single()

    // Send emails
    if (reservation) {
      await Promise.all([
        sendOwnerAlert(reservation),
        sendGuestConfirmation(reservation),
      ])
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    await supabase
      .from('reservations')
      .update({ status: 'cancelled', payment_status: 'cancelled' })
      .eq('stripe_session_id', session.id)
      .eq('status', 'pending')
  }

  return NextResponse.json({ received: true })
}
