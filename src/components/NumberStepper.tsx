import { useId } from 'react'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  step: number
  /** Decimal places kept when stepping. */
  decimals?: number
  min?: number
  inputMode?: 'decimal' | 'numeric' | 'text'
  placeholder?: string
  /** Marks the field as holding an invalid value. */
  invalid?: boolean
}

/** Big −/+ buttons around a text input: fast one-handed entry with the phone keyboard as a fallback. */
export function NumberStepper({
  label,
  value,
  onChange,
  step,
  decimals = 2,
  min = 0,
  inputMode = 'decimal',
  placeholder,
  invalid = false,
}: Props) {
  const id = useId()
  const bump = (dir: 1 | -1) => {
    const current = Number(value.replace(',', '.'))
    const base = Number.isFinite(current) ? current : 0
    const next = Math.max(min, base + dir * step)
    onChange(String(Math.round(next * 10 ** decimals) / 10 ** decimals))
  }

  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="eyebrow mb-1.5 block">
        {label}
      </label>
      <div
        className={`bg-surface-2 focus-within:border-accent flex items-stretch overflow-hidden rounded-xl border transition-colors ${invalid ? 'border-danger' : 'border-border-strong'}`}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => bump(-1)}
          className="active:bg-surface-3 text-muted active:text-text min-h-14 w-12 shrink-0 text-2xl font-bold"
        >
          −
        </button>
        <input
          id={id}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          onFocus={(e) => e.target.select()}
          className="numeric min-w-0 flex-1 bg-transparent text-center text-2xl outline-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => bump(1)}
          className="active:bg-surface-3 text-muted active:text-text min-h-14 w-12 shrink-0 text-2xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  )
}
