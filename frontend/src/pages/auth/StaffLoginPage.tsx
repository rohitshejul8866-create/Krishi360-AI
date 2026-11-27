import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, KeyRound, LockKeyhole, Mail, ShieldCheck, Stethoscope, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { authService } from '../../services/authService'
import { AuthShell } from './AuthShell'

export function StaffLoginPage({ defaultRole = 'admin' }: { defaultRole?: 'admin' | 'expert' }) {
  const [role, setRole] = useState<'admin' | 'expert'>(defaultRole)
  const [name, setName] = useState('Platform Administrator')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)
  const [adminEmailHint, setAdminEmailHint] = useState('admin@krishi360.in')
  const [checkingBootstrap, setCheckingBootstrap] = useState(true)

  const { loginStaff, setupInitialAdmin, loginWithGoogle, loading } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const handleGoogleSignIn = async () => {
    setError('')
    try {
      const user = await loginWithGoogle()
      show(`Signed in`, `Welcome, ${user.name}.`, 'success')
      if (user.role === 'admin') navigate('/admin/dashboard')
      else if (user.role === 'expert') navigate('/expert/dashboard')
      else navigate('/farmer/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google Sign-In failed.')
    }
  }

  useEffect(() => {
    setRole(defaultRole)
  }, [defaultRole])

  useEffect(() => {
    let active = true
    authService
      .getBootstrapStatus()
      .then((res) => {
        if (!active) return
        setSetupRequired(res.adminSetupRequired)
        if (res.adminEmailHint) {
          setAdminEmailHint(res.adminEmailHint)
        }
      })
      .catch(() => {
        if (active) setSetupRequired(false)
      })
      .finally(() => {
        if (active) setCheckingBootstrap(false)
      })
    return () => {
      active = false
    }
  }, [])

  const submitSetup = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (name.trim().length < 2) return setError('Enter administrator name.')
    if (!email.includes('@')) return setError('Enter a valid administrator email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    try {
      const user = await setupInitialAdmin({
        name: name.trim(),
        email: email.trim(),
        password,
      })
      show('Admin panel configured', `Signed in as ${user.name}.`, 'success')
      navigate('/admin/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to configure administrator account.')
    }
  }

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const user = await loginStaff({ email, password, role })
      show(
        `Signed in`,
        `Welcome to the ${role === 'admin' ? 'Admin Panel' : 'Crop Expert Portal'}, ${user.name}.`,
        'success',
      )
      navigate(role === 'admin' ? '/admin/dashboard' : '/expert/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid credentials.')
    }
  }

  const showAdminSetup = role === 'admin' && setupRequired

  return (
    <AuthShell
      eyebrow="Staff Direct Access"
      title={role === 'admin' ? 'Admin Panel Login' : 'Crop Expert Login'}
      description={
        showAdminSetup
          ? 'First-run setup: claim your Administrator email and password. Once saved, it is hashed on the server and this setup locks.'
          : role === 'admin'
            ? 'Direct sign-in for KRISHI360 platform administrators.'
            : 'Direct sign-in for Agriculture & Crop Experts provisioned through the Admin Panel.'
      }
      badgeText={role === 'admin' ? 'Admin Panel' : 'Crop Expert'}
      footer={
        <p>
          Are you a farmer?{' '}
          <Link to="/login" className="font-extrabold text-forest hover:underline">
            Farmer Login
          </Link>
          {' · '}
          <Link to="/register" className="font-extrabold text-forest hover:underline">
            Farmer Registration
          </Link>
        </p>
      }
    >
      <div className="grid grid-cols-2 gap-2 rounded-2xl inset-field p-1.5">
        <button
          type="button"
          onClick={() => {
            setRole('admin')
            setError('')
          }}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold transition-all ${
            role === 'admin'
              ? 'bg-forest text-white shadow-[0_8px_18px_-12px_rgba(52,75,53,0.9)]'
              : 'text-muted hover:text-ink'
          }`}
        >
          <ShieldCheck size={15} /> Admin Panel
        </button>
        <button
          type="button"
          onClick={() => {
            setRole('expert')
            setError('')
          }}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-extrabold transition-all ${
            role === 'expert'
              ? 'bg-forest text-white shadow-[0_8px_18px_-12px_rgba(52,75,53,0.9)]'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Stethoscope size={15} /> Crop Expert
        </button>
      </div>

      {checkingBootstrap ? (
        <p className="mt-8 text-center text-xs text-muted">Checking server configuration…</p>
      ) : showAdminSetup ? (
        <form onSubmit={(event) => void submitSetup(event)} className="mt-6 space-y-4">
          <div className="rounded-2xl border border-sage/40 bg-soft-sage/45 px-4 py-3 text-xs leading-relaxed text-ink">
            <p className="font-extrabold text-forest">Initial Admin Setup</p>
            <p className="mt-1 text-muted">
              Claim your administrator email and password now (or set <code className="font-mono text-forest">ADMIN_EMAIL</code> and <code className="font-mono text-forest">ADMIN_PASSCODE</code> in Secrets). If your email already has a farmer account, enter its current password to upgrade it to Admin.
            </p>
          </div>
          <Field label="Administrator name" required>
            <div className="relative">
              <UserRound size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Platform Administrator"
                className="pl-11"
                required
              />
            </div>
          </Field>
          <Field label="Administrator email" required>
            <div className="relative">
              <Mail size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={adminEmailHint}
                className="pl-11"
                autoComplete="email"
                required
              />
            </div>
          </Field>
          <Field label="Create password" required>
            <div className="relative">
              <KeyRound size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="8+ characters"
                className="pl-11"
                required
              />
            </div>
          </Field>
          <Field label="Confirm password" required>
            <div className="relative">
              <LockKeyhole size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat password"
                className="pl-11"
                required
              />
            </div>
          </Field>
          {error ? <p className="rounded-2xl bg-[#FBE7E3] px-4 py-3 text-xs font-semibold text-alert">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Setting up Admin…' : 'Create Admin & Enter Panel'} <ArrowRight size={17} />
          </Button>
        </form>
      ) : (
        <form onSubmit={(event) => void submitLogin(event)} className="mt-6 space-y-5">
          <Field label={role === 'admin' ? 'Administrator email' : 'Crop Expert email'} required>
            <div className="relative">
              <Mail size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={role === 'admin' ? adminEmailHint : 'expert@krishi360.in'}
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
                placeholder="Enter password"
                className="pl-11"
                autoComplete="current-password"
                required
              />
            </div>
          </Field>
          {role === 'expert' ? (
            <p className="rounded-2xl border border-line/80 bg-white/70 px-4 py-3 text-[11px] leading-relaxed text-muted">
              Crop Expert credentials are created and managed inside <span className="font-bold text-ink">Admin Panel → Expert Management</span>.
            </p>
          ) : null}
          {error ? <p className="rounded-2xl bg-[#FBE7E3] px-4 py-3 text-xs font-semibold text-alert">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : `Enter ${role === 'admin' ? 'Admin Panel' : 'Crop Expert Portal'}`} <ArrowRight size={17} />
          </Button>
        </form>
      )}

      {role === 'admin' ? (
        <div className="mt-5 space-y-3 border-t border-line/70 pt-4">
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink shadow-xs transition hover:border-forest/40 hover:bg-soft-sage/30 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
            </svg>
            Continue with Google (Admin)
          </button>
        </div>
      ) : null}
    </AuthShell>
  )
}
