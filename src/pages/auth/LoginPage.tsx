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
  const { loginFarmer, loading } = useAuth()
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

  return (
    <AuthShell
      eyebrow="Farmer Portal"
      title="Farmer sign in"
      description="Sign in with your registered farmer email and password to manage your farm, crops, storage and schemes."
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
    </AuthShell>
  )
}
