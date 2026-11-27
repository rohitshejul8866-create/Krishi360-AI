import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { AuthShell } from './AuthShell'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const { registerFarmer, loginWithGoogle, loading } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (name.trim().length < 2) return setError('Enter your full name.')
    if (!email.includes('@')) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    try {
      const user = await registerFarmer({
        name: name.trim(),
        email: email.trim(),
        password,
        location: location.trim() || 'India',
        phone: phone.trim() || undefined,
      })
      show('Account created', `Welcome to KRISHI360 AI, ${user.name}.`, 'success')
      navigate('/farmer/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create farmer account.')
    }
  }

  const handleGoogleSignUp = async () => {
    setError('')
    try {
      const user = await loginWithGoogle()
      show('Account ready', `Welcome to KRISHI360 AI, ${user.name}. Cloud workspace initialized.`, 'success')
      if (user.role === 'admin') navigate('/admin/dashboard')
      else if (user.role === 'expert') navigate('/expert/dashboard')
      else navigate('/farmer/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google Sign-In failed. Please try again.')
    }
  }

  return (
    <AuthShell
      eyebrow="Farmer Registration"
      title="Create your farmer account"
      description="Register your grower profile to access crop health diagnostics, mandi prices, irrigation planning, storage tracking and schemes."
      badgeText="Farmer Signup"
      footer={
        <div className="space-y-3">
          <p>
            Already registered as a farmer?{' '}
            <Link to="/login" className="font-extrabold text-forest hover:underline">
              Farmer Sign in
            </Link>
          </p>
          <p>
            Crop Expert or Admin?{' '}
            <Link to="/admin/login" className="inline-flex items-center gap-1 font-extrabold text-forest hover:underline">
              <ShieldCheck size={13} /> Open Admin & Expert Login Panel
            </Link>
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void handleGoogleSignUp()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink shadow-xs transition hover:border-forest/40 hover:bg-soft-sage/30 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
          </svg>
          Continue with Google
        </button>

        <div className="relative flex items-center py-1">
          <span className="h-px flex-1 bg-line" />
          <span className="px-3 text-[11px] font-bold tracking-wider text-muted uppercase">or register with email</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <Field label="Full name" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ramesh Patil" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email address" required>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.in" required />
            </Field>
            <Field label="Phone number" hint="Optional">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" />
            </Field>
          </div>
          <Field label="Location (District, State)" required>
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Nashik, Maharashtra" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" required>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters" required />
            </Field>
            <Field label="Confirm password" required>
              <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat password" required />
            </Field>
          </div>
          {error ? <p className="rounded-2xl bg-[#FBE7E3] px-4 py-3 text-xs font-semibold text-alert">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Creating farmer account…' : 'Register as Farmer'} <ArrowRight size={17} />
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}
