import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Input'
import { AuthShell } from './AuthShell'

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { show } = useToast()
  const navigate = useNavigate()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.resetPassword(password, confirm)
      show('Demo password updated', 'You can now sign in with the demo experience.', 'success')
      navigate('/login')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="New password"
      title="Choose a demo password"
      description="Pick any password with at least eight characters. This simulation never stores or transmits it."
      footer={<Link to="/login" className="font-extrabold text-forest hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <Field label="New password" required>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat password" />
        </Field>
        {error ? <p className="rounded-2xl bg-[#FBE7E3] px-4 py-3 text-xs font-semibold text-alert">{error}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Updating…' : 'Reset demo password'} <ArrowRight size={16} />
        </Button>
      </form>
    </AuthShell>
  )
}
