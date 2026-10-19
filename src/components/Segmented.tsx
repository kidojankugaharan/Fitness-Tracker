import { useId } from 'react'

type Props<T extends string> = {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  /** Show the label beside the control (settings rows) instead of above it (forms). */
  inline?: boolean
}

/**
 * A segmented control built from native radio inputs, so keyboard (arrow keys), focus and screen
 * reader behaviour come from the browser.
 */
export function Segmented<T extends string>({ label, value, options, onChange, inline = false }: Props<T>) {
  const name = useId()
  return (
    <fieldset className={inline ? 'flex items-center justify-between gap-4' : 'block'}>
      <legend className={inline ? 'float-left font-medium' : 'eyebrow mb-1.5 block'}>{label}</legend>
      <div className={`bg-surface-2 border-border flex rounded-xl border p-1 ${inline ? '' : 'w-full'}`}>
        {options.map((option) => (
          <label key={option.value} className={inline ? 'min-w-14' : 'flex-1'}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="font-display text-muted peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:ring-accent-bright flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-3 text-[0.9375rem] font-bold tracking-wide uppercase transition-colors peer-focus-visible:ring-2">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
