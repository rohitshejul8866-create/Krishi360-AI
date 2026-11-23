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
  const { registerFarmer, loading } = useAuth()
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
    </AuthShell>
  )
}
