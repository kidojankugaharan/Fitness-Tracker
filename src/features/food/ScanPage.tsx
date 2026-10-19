import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { isValidBarcode } from '@/domain/barcode'
import { dateFromParam } from '@/domain/dates'
import { createScanConfirmer } from '@/domain/scanConfirm'
import {
  backCameras,
  exposureRange,
  exposureWithLight,
  openScanCamera,
  rememberCamera,
  setExposure,
  setTorch,
  snapExposure,
  torchSupported,
  type ExposureRange,
} from '@/lib/barcode/camera'
import { getDetector } from '@/lib/barcode/detector'
import { barcodePath, diaryPath } from './paths'

const SCAN_INTERVAL_MS = 120
// After "Add & scan next", the previous item must be out of view this long before it can scan again.
const IGNORE_CLEAR_MS = 1000

type Scanning = {
  kind: 'scanning'
  /** null when the camera has no controllable light (e.g. iPhone browsers). */
  torch: boolean | null
  /** Brightness slider, where the camera supports exposure compensation (Android Chrome). */
  exposure: { range: ExposureRange; value: number } | null
  /** Back cameras to switch between (only shown when there is more than one). */
  cameras: string[]
  deviceId: string | null
}

type CameraState = { kind: 'starting' } | Scanning | { kind: 'error'; message: string }

export function ScanPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const date = dateFromParam(params.get('date'))
  const meal = params.get('meal') ?? undefined
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [camera, setCamera] = useState<CameraState>({ kind: 'starting' })
  // A camera the user switched to; changing it restarts the scanner with that camera.
  const [chosenCamera, setChosenCamera] = useState<string | undefined>(undefined)
  const [manual, setManual] = useState('')

  const found = (code: string) => {
    navigator.vibrate?.(30)
    navigate(barcodePath(code, date, meal), { replace: true })
  }

  useEffect(() => {
    let stopped = false
    let ignore = (location.state as { ignore?: string } | null)?.ignore ?? null
    let ignoreAbsentSince: number | null = null
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    // Two frames must agree before a code is accepted (a single misread frame is ignored).
    const confirm = createScanConfirmer()

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera({
          kind: 'error',
          message: 'The camera needs a secure (https) connection. Type the barcode below.',
        })
        return
      }
      try {
        // Camera and decoder start together; a sharper picture where the fast native decoder exists.
        const native = 'BarcodeDetector' in globalThis
        const [detector, cam] = await Promise.all([getDetector(), openScanCamera(native, chosenCamera)])
        stream = cam.stream
        if (stopped) {
          // Closed while the camera was starting: the cleanup already ran, so stop it here.
          cam.stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current!
        video.srcObject = cam.stream
        await video.play()
        trackRef.current = cam.track
        const range = exposureRange(cam.track)
        const cameras = (await backCameras().catch(() => [])).map((d) => d.deviceId)
        setCamera({
          kind: 'scanning',
          torch: torchSupported(cam.track) ? false : null,
          exposure: range ? { range, value: snapExposure(range, 0) } : null,
          cameras,
          deviceId: cam.deviceId,
        })

        const tick = async () => {
          if (stopped) return
          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            try {
              const codes = await detector.detect(video)
              const valid = codes.map((c) => c.rawValue.trim()).filter(isValidBarcode)
              // After "Add & scan next" the same item is often still in view: ignore it until it has
              // been out of the frame for a while (a single blurry frame doesn't count), so one tap
              // never logs it twice.
              if (ignore !== null) {
                if (valid.includes(ignore)) ignoreAbsentSince = null
                else if (ignoreAbsentSince === null) ignoreAbsentSince = Date.now()
                else if (Date.now() - ignoreAbsentSince >= IGNORE_CLEAR_MS) ignore = null
              }
              const hit = confirm(
                valid.filter((c) => c !== ignore),
                Date.now(),
              )
              if (hit && !stopped) {
                stopped = true
                rememberCamera(cam.deviceId) // this lens reads barcodes: open it first next time
                found(hit)
                return
              }
            } catch {
              // A frame can fail to decode (e.g. while the camera refocuses); just try the next one.
            }
          }
          timer = setTimeout(tick, SCAN_INTERVAL_MS)
        }
        tick()
      } catch (err) {
        if (stopped) return
        const name = err instanceof DOMException ? err.name : ''
        setCamera({
          kind: 'error',
          message:
            name === 'NotAllowedError'
              ? 'Camera access was blocked. Allow it in your browser settings, or type the barcode below.'
              : name === 'NotFoundError' || name === 'OverconstrainedError'
                ? 'No camera found. Type the barcode below.'
                : "Couldn't start the camera. Type the barcode below.",
        })
      }
    }

    start()
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      trackRef.current = null
    }
    // Restart only when the user picks another camera; `found` only navigates away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenCamera])

  const scanning = camera.kind === 'scanning' ? camera : null

  const toggleTorch = async () => {
    const track = trackRef.current
    if (!scanning || scanning.torch === null || !track) return
    const on = !scanning.torch
    try {
      await setTorch(track, on)
      // The light can't be dimmed, so with it on the picture starts darker to cut glare.
      let exposure = scanning.exposure
      if (exposure) {
        const value = on ? exposureWithLight(exposure.range) : snapExposure(exposure.range, 0)
        await setExposure(track, value).catch(() => {})
        exposure = { ...exposure, value }
      }
      setCamera({ ...scanning, torch: on, exposure })
    } catch {
      setCamera({ ...scanning, torch: null })
    }
  }

  const changeExposure = (value: number) => {
    const track = trackRef.current
    if (!scanning?.exposure || !track) return
    setCamera({ ...scanning, exposure: { ...scanning.exposure, value } })
    void setExposure(track, value).catch(() => {})
  }

  const switchCamera = () => {
    if (!scanning || scanning.cameras.length < 2) return
    const i = scanning.cameras.indexOf(scanning.deviceId ?? '')
    setCamera({ kind: 'starting' })
    setChosenCamera(scanning.cameras[(i + 1) % scanning.cameras.length])
  }

  const manualCode = manual.replace(/\s/g, '')
  const manualValid = isValidBarcode(manualCode)

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black text-white">
      <div className="pt-safe flex items-center justify-between px-4 py-2">
        <button
          type="button"
          onClick={() => navigate(diaryPath(date))}
          className="min-h-11 px-2 text-base font-semibold"
        >
          Cancel
        </button>
        <span className="font-semibold">Scan barcode</span>
        {scanning && scanning.torch !== null ? (
          <button
            type="button"
            aria-pressed={scanning.torch}
            onClick={toggleTorch}
            className="min-h-11 px-2 text-base font-semibold"
          >
            {scanning.torch ? 'Light off' : 'Light'}
          </button>
        ) : (
          <span className="w-16" />
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
        {camera.kind !== 'error' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-[80%] max-w-sm rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-3 space-y-2 px-4">
          {scanning?.exposure && (
            <label className="mx-auto flex max-w-sm items-center gap-3 rounded-xl bg-black/60 px-3 py-2 text-sm">
              <span className="shrink-0 font-medium">Brightness</span>
              <input
                type="range"
                aria-label="Brightness"
                min={scanning.exposure.range.min}
                max={scanning.exposure.range.max}
                step={scanning.exposure.range.step}
                value={scanning.exposure.value}
                onChange={(e) => changeExposure(Number(e.target.value))}
                className="min-h-11 flex-1 accent-white"
              />
            </label>
          )}
          <p role="status" className="text-center text-sm font-medium text-white/90">
            {camera.kind === 'starting' && 'Starting camera…'}
            {scanning &&
              (scanning.torch
                ? 'Glare? Slide brightness down or tilt the package slightly.'
                : 'Point at the barcode — it scans automatically.')}
            {camera.kind === 'error' && camera.message}
          </p>
          {scanning && scanning.cameras.length > 1 && (
            <div className="text-center">
              <button
                type="button"
                onClick={switchCamera}
                className="min-h-11 rounded-xl bg-black/60 px-4 text-sm font-semibold"
              >
                Switch camera
              </button>
            </div>
          )}
        </div>
      </div>

      <form
        className="pb-safe bg-black px-4 pt-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (manualValid) found(manualCode)
        }}
      >
        <div className="mx-auto flex max-w-xl gap-2 pb-3">
          <input
            inputMode="numeric"
            aria-label="Barcode number"
            placeholder="Or type the barcode number"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-xl bg-white/10 px-4 text-base text-white placeholder:text-white/50"
          />
          <Button type="submit" disabled={!manualValid}>
            Look up
          </Button>
        </div>
      </form>
    </div>
  )
}
