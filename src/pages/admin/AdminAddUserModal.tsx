import { useState } from 'react'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { useApp } from '../../services/store'
import type { Role } from '../../types'

export function AdminAddUserModal({ role, open, onClose }: { role: Exclude<Role, 'admin'>; open: boolean; onClose: () => void }) {
  const { createUserAccount } = useApp()
  const { show } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [location, setLocation] = useState('')
  const [phone, setPhone] = useState('')
  const [specialisation, setSpecialisation] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setLocation('')
    setPhone('')
    setSpecialisation('')
    setErrors({})
    setSaving(false)
    onClose()
  }

  const submit = async () => {
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = 'Enter at least 2 characters.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (location.trim().length < 2) next.location = 'Enter a location.'
    if (phone.trim().length < 7) next.phone = 'Enter a valid phone number.'
    if (role === 'expert' && specialisation.trim().length < 3) next.specialisation = 'Enter a specialisation.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      await createUserAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        location: location.trim(),
        phone: phone.trim(),
        specialisation: role === 'expert' ? specialisation.trim() : undefined,
      })
      show(
        `${role === 'expert' ? 'Crop Expert' : 'Farmer'} account created`,
        `${name.trim()} can now sign in via ${role === 'expert' ? '/expert/login' : '/login'}.`,
        'success',
      )
      reset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create account.'
      setErrors({ form: msg })
      setSaving(false)
    }
  }

  const roleTitle = role === 'expert' ? 'Crop Expert' : 'Farmer'

  return (
    <Modal
      open={open}
      onClose={reset}
      title={`Add ${roleTitle}`}
      description={
        role === 'expert'
          ? 'Creates a verified Crop Expert account that can sign in directly at /expert/login.'
          : 'Creates a Farmer account that can sign in directly at /login.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={reset} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving}>
            <UserPlus size={16} /> {saving ? 'Creating...' : `Create ${roleTitle}`}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name}>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Dr. Meera Kulkarni" />
        </Field>
        <Field label="Email" required error={errors.email}>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@krishi360.in" />
        </Field>
        <Field label="Password" required error={errors.password} className="sm:col-span-2">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label="Location" required error={errors.location}>
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Pune, Maharashtra" />
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" />
        </Field>
        {role === 'expert' ? (
          <Field label="Specialisation" required error={errors.specialisation} className="sm:col-span-2">
            <Input value={specialisation} onChange={(event) => setSpecialisation(event.target.value)} placeholder="Plant pathology & pest diagnostics" />
          </Field>
        ) : null}
        {errors.form ? (
          <p className="sm:col-span-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            {errors.form}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
