import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/Button'
import { isValidBarcode } from '@/domain/barcode'
import { dateFromParam } from '@/domain/dates'
import { createScanConfirmer } from '@/domain/scanConfirm'
import { getDetector } from '@/lib/barcode/detector'
import { barcodePath, diaryPath } from './paths'

const SCAN_INTERVAL_MS = 120
// After "Add & scan next", the previous item must be out of view this long before it can scan again.
const IGNORE_CLEAR_MS = 1000

type CameraState =
  { kind: 'starting' } | { kind: 'scanning'; torch: boolean | null } | { kind: 'error'; message: string }

type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean }

export function ScanPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const date = dateFromParam(params.get('date'))
  const meal = params.get('meal') ?? undefined
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [camera, setCamera] = useState<CameraState>({ kind: 'starting' })
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
        const [detector, media] = await Promise.all([
          getDetector(),
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          }),
        ])
        stream = media
        if (stopped) {
          // Closed while the camera was starting: the cleanup already ran, so stop it here.
          media.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current!
        video.srcObject = media
        await video.play()
        const track = media.getVideoTracks()[0] ?? null
        trackRef.current = track
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
        setCamera({ kind: 'scanning', torch: caps.torch ? false : null })

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
    // Start the camera once per mount; `found` only navigates away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTorch = async () => {
    if (camera.kind !== 'scanning' || camera.torch === null || !trackRef.current) return
    const next = !camera.torch
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: next } as TorchConstraints] })
      setCamera({ kind: 'scanning', torch: next })
    } catch {
      setCamera({ kind: 'scanning', torch: null })
    }
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
        {camera.kind === 'scanning' && camera.torch !== null ? (
          <button
            type="button"
            aria-pressed={camera.torch}
            onClick={toggleTorch}
            className="min-h-11 px-2 text-base font-semibold"
          >
            {camera.torch ? 'Light off' : 'Light'}
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
        <p
          role="status"
          className="absolute inset-x-0 bottom-4 px-6 text-center text-sm font-medium text-white/90"
        >
          {camera.kind === 'starting' && 'Starting camera…'}
          {camera.kind === 'scanning' && 'Point at the barcode — it scans automatically.'}
          {camera.kind === 'error' && camera.message}
        </p>
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
