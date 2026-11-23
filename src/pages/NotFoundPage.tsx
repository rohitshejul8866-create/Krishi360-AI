import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { buttonClasses } from '../components/ui/Button'
import { MarketingNav } from '../components/navigation/MarketingNav'
import { Footer } from '../components/navigation/Footer'
import { Brand } from '../components/common/Brand'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <MarketingNav />
      <main className="flex flex-1 items-center justify-center px-4 py-24 sm:px-6">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto mb-8 flex size-24 items-center justify-center rounded-[32px] border border-white/80 bg-white/70 text-forest shadow-[0_24px_60px_-35px_rgba(29,42,30,0.6)] backdrop-blur-xl">
            <Compass size={40} />
          </div>
          <p className="text-[11px] font-extrabold tracking-[0.2em] text-forest uppercase">Route not found</p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-[-0.06em] text-ink sm:text-6xl">404</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base">
            This page is not available. Head back to the home page or sign in to your portal.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/" className={buttonClasses('primary', 'lg')}><Home size={16} /> Back to home</Link>
            <Link to="/login" className={buttonClasses('outline', 'lg')}><ArrowLeft size={16} /> Farmer Sign In</Link>
          </div>
          <div className="mt-10 flex justify-center"><Brand compact /></div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
