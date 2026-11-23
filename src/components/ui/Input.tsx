import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

const controlClasses =
  'w-full rounded-2xl inset-field px-4 py-3 text-sm text-ink placeholder:text-muted/80 transition-all duration-300 focus:border-sage focus:bg-white focus:outline-none focus:ring-4 focus:ring-sage/15 disabled:opacity-60'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {label}
        {required ? <span className="ml-1 text-alert">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-semibold text-alert">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClasses} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClasses} min-h-28 resize-y ${className}`} {...props} />
}

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[]
  placeholder?: string
}

export function Select({ options, placeholder, className = '', ...props }: SelectProps) {
  const hasWidth = /\bw-/.test(className)

  return (
    <div className={`relative ${hasWidth ? className : 'w-full'}`}>
      <select
        className={`${controlClasses} appearance-none pr-10 ${hasWidth ? '' : className}`}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
      />
    </div>
  )
}
