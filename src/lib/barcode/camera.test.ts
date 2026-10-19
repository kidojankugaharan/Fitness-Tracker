import { describe, expect, it } from 'vitest'
import { exposureWithLight, snapExposure } from './camera'

describe('exposure helpers', () => {
  const range = { min: -2, max: 2, step: 1 / 3 }

  it('snaps onto the camera steps and stays within range', () => {
    expect(snapExposure(range, 0.1)).toBe(0)
    expect(snapExposure(range, 5)).toBe(2)
    expect(snapExposure(range, -5)).toBe(-2)
  })

  it('starts darker (about −1 EV) when the light is on, to cut glare', () => {
    expect(exposureWithLight(range)).toBe(-1)
    expect(exposureWithLight({ min: -0.5, max: 0.5, step: 0.1 })).toBe(-0.5) // clamped
  })
})
