import { describe, expect, it } from 'vitest'
import { createScanConfirmer } from './scanConfirm'

describe('createScanConfirmer', () => {
  it('accepts a code once two frames agree', () => {
    const confirm = createScanConfirmer()
    expect(confirm(['0064100780101'], 0)).toBeNull()
    expect(confirm(['0064100780101'], 120)).toBe('0064100780101')
  })

  it('ignores a one-frame misread between good reads of another code', () => {
    const confirm = createScanConfirmer()
    expect(confirm(['0064100780101'], 0)).toBeNull()
    expect(confirm(['64100785'], 120)).toBeNull() // misread
    expect(confirm(['0064100780101'], 240)).toBe('0064100780101')
  })

  it('forgets reads older than the window', () => {
    const confirm = createScanConfirmer(2, 1500)
    expect(confirm(['12345670'], 0)).toBeNull()
    expect(confirm(['12345670'], 2000)).toBeNull()
    expect(confirm([], 2100)).toBeNull()
  })

  it('does not count the same code twice in one frame', () => {
    const confirm = createScanConfirmer()
    expect(confirm(['0064100780101', '0064100780101'], 0)).toBeNull()
  })
})
