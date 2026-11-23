import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { authService } from '../../services/authService'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { AuthShell } from './AuthShell'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.requestPasswordReset(email)
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not continue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your demo password"
      description="This screen simulates a recovery flow. No email is sent in the frontend-only build."
      footer={<Link to="/login" className="font-extrabold text-forest hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <div className="rounded-3xl bg-soft-sage/70 p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto text-forest" />
          <h2 className="mt-4 text-lg font-extrabold text-ink">Demo reset link ready</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            In a production build, a secure link would be sent to {email}. Continue to the simulated reset screen.
          </p>
          <Link to="/reset-password" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-forest px-6 py-3 text-sm font-bold text-white">
            Continue <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <Field label="Email address" required>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.in" />
          </Field>
          {error ? <p className="rounded-2xl bg-[#FBE7E3] px-4 py-3 text-xs font-semibold text-alert">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Checking…' : 'Continue'} <ArrowRight size={16} />
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
