import { Footer } from '../../components/navigation/Footer'
import { MarketingNav } from '../../components/navigation/MarketingNav'
import { Hero } from './Hero'
import { ProblemSolution } from './ProblemSolution'
import { ModulesShowcase } from './ModulesShowcase'
import { HowItWorks } from './HowItWorks'
import { RolesShowcase } from './RolesShowcase'
import { TrustSection } from './TrustSection'
import { FinalCTA } from './FinalCTA'

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main>
        <Hero />
        <ProblemSolution />
        <ModulesShowcase />
        <HowItWorks />
        <RolesShowcase />
        <TrustSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}
