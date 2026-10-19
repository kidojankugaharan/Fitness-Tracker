// Opening the right camera for scanning. Phones often have several back cameras (main, ultra-wide,
// telephoto); `facingMode: environment` lets the browser pick any of them, and an ultra-wide lens
// can't focus up close, so scans become slow or fail. We prefer the main back camera, remember the
// one that last scanned successfully, and let the user switch.

const SAVED_CAMERA_KEY = 'scanner-camera'

export type ScanCamera = { stream: MediaStream; track: MediaStreamTrack; deviceId: string | null }

/** Brightness (exposure compensation) range, where the camera supports it (Android Chrome). */
export type ExposureRange = { min: number; max: number; step: number }

type ExtendedCapabilities = MediaTrackCapabilities & {
  torch?: boolean
  focusMode?: string[]
  exposureMode?: string[]
  exposureCompensation?: { min?: number; max?: number; step?: number }
}
type ExtendedConstraints = MediaTrackConstraintSet & {
  torch?: boolean
  focusMode?: string
  exposureMode?: string
  exposureCompensation?: number
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(SAVED_CAMERA_KEY)
  } catch {
    return null
  }
}

/** Remember the camera that worked, so the next scan opens it straight away. */
export function rememberCamera(deviceId: string | null) {
  try {
    if (deviceId) localStorage.setItem(SAVED_CAMERA_KEY, deviceId)
  } catch {
    // Storage blocked: we'll just pick again next time.
  }
}

const isBack = (d: MediaDeviceInfo) => /back|rear|environment/i.test(d.label)

/** The back cameras, main camera first ("camera2 0, facing back" on Android is the main lens). */
export async function backCameras(): Promise<MediaDeviceInfo[]> {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
  const back = devices.filter(isBack)
  const main = (d: MediaDeviceInfo) => (/\b0,\s*facing back/i.test(d.label) ? 0 : 1)
  return [...back].sort((a, b) => main(a) - main(b))
}

function videoConstraints(deviceId: string | null, sharp: boolean): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
    // The native detector is fast enough for a sharper picture, which reads small barcodes better.
    width: { ideal: sharp ? 1920 : 1280 },
    height: { ideal: sharp ? 1080 : 720 },
  }
}

async function open(deviceId: string | null, sharp: boolean): Promise<ScanCamera> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: videoConstraints(deviceId, sharp),
  })
  const track = stream.getVideoTracks()[0]!
  const caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities
  if (caps.focusMode?.includes('continuous')) {
    await track
      .applyConstraints({ advanced: [{ focusMode: 'continuous' } as ExtendedConstraints] })
      .catch(() => {})
  }
  return { stream, track, deviceId: track.getSettings().deviceId ?? deviceId }
}

/**
 * Open a back camera: `deviceId` if given, else the remembered one, else the main back camera.
 * `sharp` asks for 1080p (use it with the native detector).
 */
export async function openScanCamera(sharp: boolean, deviceId?: string): Promise<ScanCamera> {
  const wanted = deviceId ?? readSaved()
  if (wanted) {
    try {
      return await open(wanted, sharp)
    } catch {
      // That camera is gone (other phone, permissions reset): fall back to choosing again.
    }
  }
  const first = await open(null, sharp)
  // Device labels are only available once permission is granted, i.e. now.
  const main = (await backCameras().catch(() => []))[0]
  if (!main || main.deviceId === first.deviceId) return first
  first.stream.getTracks().forEach((t) => t.stop())
  return open(main.deviceId, sharp).catch(() => open(null, sharp))
}

export function torchSupported(track: MediaStreamTrack): boolean {
  return !!(track.getCapabilities?.() as ExtendedCapabilities | undefined)?.torch
}

export function exposureRange(track: MediaStreamTrack): ExposureRange | null {
  const ec = (track.getCapabilities?.() as ExtendedCapabilities | undefined)?.exposureCompensation
  if (ec?.min == null || ec.max == null || ec.max <= ec.min) return null
  return { min: ec.min, max: ec.max, step: ec.step && ec.step > 0 ? ec.step : (ec.max - ec.min) / 20 }
}

export async function setTorch(track: MediaStreamTrack, on: boolean) {
  await track.applyConstraints({ advanced: [{ torch: on } as ExtendedConstraints] })
}

export async function setExposure(track: MediaStreamTrack, value: number) {
  await track.applyConstraints({
    advanced: [{ exposureMode: 'continuous', exposureCompensation: value } as ExtendedConstraints],
  })
}

/** Snap a value onto the camera's exposure steps, within its range. */
export function snapExposure(range: ExposureRange, value: number): number {
  const clamped = Math.max(range.min, Math.min(range.max, value))
  const snapped = range.min + Math.round((clamped - range.min) / range.step) * range.step
  return Math.round(Math.min(range.max, snapped) * 1000) / 1000
}

/**
 * Browsers can only switch the light fully on or off, so glare is reduced by darkening the exposure
 * instead: with the light on, start at about −1 EV (the user can slide it either way).
 */
export function exposureWithLight(range: ExposureRange): number {
  return snapExposure(range, -1)
}
