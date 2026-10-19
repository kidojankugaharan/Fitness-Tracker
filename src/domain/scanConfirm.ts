// A camera decoder can misread a single blurry frame as a different, checksum-valid code (e.g. part
// of an EAN-13 read as an EAN-8). A code is only accepted once it has been read in several frames
// within a short window, so a one-frame misread never opens the wrong product.

export const CONFIRM_READS = 2
export const CONFIRM_WINDOW_MS = 1500

/** Feed each frame's codes; returns the first code read `reads` times within `windowMs`, else null. */
export function createScanConfirmer(reads = CONFIRM_READS, windowMs = CONFIRM_WINDOW_MS) {
  let seen: { code: string; at: number }[] = []
  return (codes: string[], now: number): string | null => {
    seen = seen.filter((s) => now - s.at <= windowMs)
    for (const code of new Set(codes)) seen.push({ code, at: now })
    for (const code of new Set(codes)) {
      if (seen.filter((s) => s.code === code).length >= reads) return code
    }
    return null
  }
}
