import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Sprout } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { AuthShell } from './AuthShell'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { loginFarmer, loginWithGoogle, loading } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const user = await loginFarmer({ email, password })
      show(`Welcome back, ${user.name.split(' ')[0]}`, 'Signed in to Farmer Portal.', 'success')
      navigate('/farmer/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid farmer email or password.')
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    try {
      const user = await loginWithGoogle()
      show(`Welcome, ${user.name.split(' ')[0]}`, 'Signed in with Google & synced to Cloud Firestore.', 'success')
      if (user.role === 'admin') navigate('/admin/dashboard')
      else if (user.role === 'expert') navigate('/expert/dashboard')
      else navigate('/farmer/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google Sign-In failed. Please try again.')
    }
  }

  return (
    <AuthShell
      eyebrow="Farmer Portal"
      title="Farmer sign in"
      description="Sign in with your registered farmer email and password or Google account to save farms, plots, crops and schemes."
      badgeText="Farmer Login"
      footer={
        <div className="space-y-3">
          <p>
            New farmer?{' '}
            <Link to="/register" className="font-extrabold text-forest hover:underline">
              Create farmer account
            </Link>
          </p>
          <div className="rounded-2xl border border-line/80 bg-white/70 p-3.5 text-left">
            <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">
              Crop Expert & Administrator
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink">Direct staff portal access</span>
              <div className="flex items-center gap-3">
                <Link
                  to="/expert/login"
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-forest hover:underline"
                >
                  <Sprout size={13} /> Expert Login
                </Link>
                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-forest hover:underline"
                >
                  <ShieldCheck size={13} /> Admin Panel Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
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
          <span className="px-3 text-[11px] font-bold tracking-wider text-muted uppercase">or email sign in</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <Field label="Farmer email" required>
            <div className="relative">
              <Mail size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.in"
                className="pl-11"
                autoComplete="email"
                required
              />
            </div>
          </Field>
          <Field label="Password" required>
            <div className="relative">
              <LockKeyhole size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="pl-11"
                autoComplete="current-password"
                required
              />
            </div>
          </Field>

          {error ? <p className="rounded-2xl bg-[#FBE7E3] px-4 py-3 text-xs font-semibold text-alert">{error}</p> : null}

          <div className="flex items-center justify-end">
            <Link to="/forgot-password" className="text-xs font-extrabold text-forest hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in as Farmer'} <ArrowRight size={17} />
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}
