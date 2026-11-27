import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Tier 1: Case A Google Maps Platform Demo Key quota & auth failure defense
if (typeof window !== 'undefined') {
  ;(window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'))
  }
  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    const joined = args.map((item) => (typeof item === 'string' ? item : String(item ?? ''))).join(' ')
    if (/OverQuotaMapError|QuotaExceededError|Google Maps JavaScript API error/i.test(joined)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'))
    }
    origError(...args)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
