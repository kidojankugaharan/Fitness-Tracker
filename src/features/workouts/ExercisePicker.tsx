import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import type { ExerciseCategory, ExerciseType } from '@/lib/supabase/database.types'
import {
  EXERCISE_CATEGORIES,
  EXERCISE_TYPE_LABELS,
  useCreateExercise,
  useExercises,
  type Exercise,
} from '@/lib/supabase/exercises'

type Props = {
  excludeIds: string[]
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

export function ExercisePicker({ excludeIds, onPick, onClose }: Props) {
  const { data: exercises = [], isPending } = useExercises()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | null>(null)
  const [creating, setCreating] = useState(false)

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return exercises.filter(
      (e) =>
        !excludeIds.includes(e.id) &&
        (!category || e.category === category) &&
        words.every((w) => e.name.toLowerCase().includes(w)),
    )
  }, [exercises, excludeIds, query, category])

  const exactExists = exercises.some((e) => e.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="bg-bg fixed inset-0 z-30 flex flex-col">
      <div className="pt-safe border-border border-b">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2">
          <input
            autoFocus
            type="search"
            aria-label="Search exercises"
            placeholder="Search exercises"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-border bg-surface min-h-11 flex-1 rounded-xl border px-4 text-base outline-none"
          />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <div className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 pb-2">
          {EXERCISE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={clsx(
                'min-h-9 shrink-0 rounded-full px-3 text-sm font-medium',
                category === c ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="pb-safe mx-auto max-w-xl px-4 py-2">
          {creating ? (
            <CreateExerciseForm
              initialName={query.trim()}
              initialCategory={category ?? 'Other'}
              onCancel={() => setCreating(false)}
              onCreated={onPick}
            />
          ) : (
            <>
              {query.trim() && !exactExists && (
                <Button variant="secondary" className="mb-2 w-full" onClick={() => setCreating(true)}>
                  + Create “{query.trim()}”
                </Button>
              )}
              {!query.trim() && (
                <Button variant="ghost" className="mb-2 w-full" onClick={() => setCreating(true)}>
                  + New custom exercise
                </Button>
              )}
              {isPending && <p className="text-muted py-4 text-center">Loading…</p>}
              <ul className="divide-border divide-y">
                {matches.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onPick(e)}
                      className="active:bg-surface-2 flex min-h-14 w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="font-medium">{e.name}</span>
                      <span className="text-muted text-sm">{e.user_id ? 'Custom' : e.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {!isPending && matches.length === 0 && (
                <p className="text-muted py-6 text-center">No matching exercises.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CreateExerciseForm({
  initialName,
  initialCategory,
  onCancel,
  onCreated,
}: {
  initialName: string
  initialCategory: ExerciseCategory
  onCancel: () => void
  onCreated: (exercise: Exercise) => void
}) {
  const create = useCreateExercise()
  const [name, setName] = useState(initialName)
  const [category, setCategory] = useState<ExerciseCategory>(initialCategory)
  const [type, setType] = useState<ExerciseType>('weight_reps')

  const selectClass = 'border-border bg-surface min-h-11 w-full rounded-xl border px-3 text-base'

  return (
    <form
      className="space-y-3 py-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        create.mutate({ name, category, type }, { onSuccess: onCreated })
      }}
    >
      <h2 className="text-lg font-semibold">New exercise</h2>
      <label className="block">
        <span className="text-muted mb-1 block text-sm">Name</span>
        <input
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={selectClass}
        />
      </label>
      <label className="block">
        <span className="text-muted mb-1 block text-sm">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
          className={selectClass}
        >
          {EXERCISE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-muted mb-1 block text-sm">Tracks</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ExerciseType)}
          className={selectClass}
        >
          {Object.entries(EXERCISE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" className="flex-[2]" disabled={create.isPending || !name.trim()}>
          Create & add
        </Button>
      </div>
    </form>
  )
}
