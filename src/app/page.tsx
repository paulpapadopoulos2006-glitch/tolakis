import Navbar             from '@/components/layout/Navbar'
import Footer             from '@/components/layout/Footer'
import HeroSection        from '@/components/sections/HeroSection'
import BookingWidget      from '@/components/sections/BookingWidget'
import PropertyHighlights from '@/components/sections/PropertyHighlights'
import AboutSection       from '@/components/sections/AboutSection'
import AmenitiesSection   from '@/components/sections/AmenitiesSection'
import GallerySection     from '@/components/sections/GallerySection'
import LocationSection    from '@/components/sections/LocationSection'
import ReviewsSection     from '@/components/sections/ReviewsSection'
import FaqSection         from '@/components/sections/FaqSection'
import WhyDirectSection   from '@/components/sections/WhyDirectSection'
import MobileBookingBar   from '@/components/sections/MobileBookingBar'
import { createAdminClient } from '@/lib/supabase/server'
import type { BlockedRange } from '@/types'

export const dynamic = 'force-dynamic'

async function getPageData(): Promise<{ blockedRanges: BlockedRange[]; baseRate: number }> {
  try {
    const supabase = createAdminClient()
    const [rangesResult, pricingResult] = await Promise.all([
      supabase.from('booked_ranges').select('check_in, check_out, source'),
      supabase.from('pricing_config').select('key, value').eq('key', 'nightly_rate').single(),
    ])
    return {
      blockedRanges: (rangesResult.data ?? []) as BlockedRange[],
      baseRate: pricingResult.data ? Number(pricingResult.data.value) : 90,
    }
  } catch {
    return { blockedRanges: [], baseRate: 90 }
  }
}

export default async function HomePage() {
  const { blockedRanges, baseRate } = await getPageData()
  return (
    <>
      <Navbar />
      <main>
        {/* Hero + floating booking widget */}
        <div className="relative">
          <HeroSection />
          {/* Booking widget — floats over bottom-right of hero on desktop */}
          <div className="hidden lg:block absolute bottom-10 right-10 xl:right-16 z-20 w-80 xl:w-96">
            <BookingWidget blockedRanges={blockedRanges} initialRate={baseRate} />
          </div>
        </div>

        <PropertyHighlights />
        <AboutSection />
        <AmenitiesSection />
        <GallerySection />
        <LocationSection />
        <ReviewsSection />
        <WhyDirectSection />
        <FaqSection />
      </main>
      <Footer />
      <MobileBookingBar initialRate={baseRate} />
    </>
  )
}
