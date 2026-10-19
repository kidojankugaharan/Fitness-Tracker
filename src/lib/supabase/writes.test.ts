import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { isTransportError, reconcileWhenIdle, stableUuid } from './writes'

describe('isTransportError', () => {
  it('recognises requests that never reached the server', () => {
    expect(isTransportError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isTransportError({ message: 'TypeError: Load failed', code: '' })).toBe(true)
    expect(isTransportError({ message: 'FetchError: network down', code: '' })).toBe(true)
  })

  it('does not retry forever on answers from the server', () => {
    expect(isTransportError({ message: 'new row violates row-level security', code: '42501' })).toBe(false)
    expect(isTransportError({ message: 'duplicate key', code: '23505' })).toBe(false)
    expect(isTransportError(new Error('boom'))).toBe(false)
    expect(isTransportError(null)).toBe(false)
  })
})

describe('stableUuid', () => {
  it('is deterministic, distinct per input and a valid UUID', async () => {
    const a = await stableUuid('copy-1', 'entry-1')
    expect(await stableUuid('copy-1', 'entry-1')).toBe(a)
    expect(await stableUuid('copy-1', 'entry-2')).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('reconcileWhenIdle', () => {
  it('refetches keys from writes that settled while others were pending', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    let finishSecond!: () => void
    const second = new MutationObserver(qc, {
      mutationKey: ['g', 'b'],
      mutationFn: () => new Promise<void>((r) => (finishSecond = r)),
      onSettled: () => reconcileWhenIdle(qc, ['g'], ['day', 'B']),
    })
    const first = new MutationObserver(qc, {
      mutationKey: ['g', 'a'],
      mutationFn: () => Promise.reject(new Error('failed')),
      onSettled: () => reconcileWhenIdle(qc, ['g'], ['day', 'A']),
    })
    const secondDone = second.mutate()
    await first.mutate().catch(() => {})
    expect(invalidate).not.toHaveBeenCalled() // B still pending
    finishSecond()
    await secondDone
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['day', 'A'],
      ['day', 'B'],
    ])
  })
})
