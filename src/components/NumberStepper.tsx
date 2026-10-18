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
      <label htmlFor={id} className="text-muted mb-1 block text-xs font-medium">
        {label}
      </label>
      <div className="border-border bg-surface-2 flex items-stretch overflow-hidden rounded-xl border">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => bump(-1)}
          className="active:bg-border min-h-12 w-12 shrink-0 text-xl font-bold"
        >
          −
        </button>
        <input
          id={id}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 bg-transparent text-center text-lg font-semibold tabular-nums outline-none"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => bump(1)}
          className="active:bg-border min-h-12 w-12 shrink-0 text-xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  )
}
