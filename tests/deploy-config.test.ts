import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// vercel.json is only read at deploy time, so a typo would otherwise surface as a broken deployment.
describe('vercel.json', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    rewrites: { source: string; destination: string }[]
  }
  const spa = config.rewrites.find((r) => r.destination === '/index.html')!
  const spaPattern = new RegExp(`^${spa.source}$`)

  it('serves the app for client-side routes', () => {
    for (const path of ['/', '/food', '/food/add', '/workout/exercise/abc'])
      expect(spaPattern.test(path)).toBe(true)
  })

  it('does not rewrite files, assets or the search proxy', () => {
    for (const path of ['/assets/index.js', '/sw.js', '/manifest.webmanifest', '/off-search/search']) {
      expect(spaPattern.test(path)).toBe(false)
    }
  })

  it('only proxies the Open Food Facts search endpoint', () => {
    const proxies = config.rewrites.filter((r) => r.destination.startsWith('http'))
    expect(proxies).toEqual([
      { source: '/off-search/search', destination: 'https://search.openfoodfacts.org/search' },
    ])
  })
})
