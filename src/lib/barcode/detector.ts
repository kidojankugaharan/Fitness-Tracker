// Barcode detection: the browser's native BarcodeDetector where it exists (Chrome on Android),
// otherwise a ZXing WebAssembly ponyfill (iOS Safari, Firefox, desktop). The ponyfill and its .wasm
// are bundled with the app and only downloaded the first time the scanner opens without native support.

const RETAIL_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export type DetectedBarcode = { rawValue: string; format: string }

export type Detector = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>
  native: boolean
}

type NativeDetectorClass = {
  new (options: { formats: string[] }): { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
  getSupportedFormats: () => Promise<string[]>
}

async function nativeDetector(): Promise<Detector | null> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (!Native) return null
  try {
    const supported = await Native.getSupportedFormats()
    const formats = RETAIL_FORMATS.filter((f) => supported.includes(f))
    if (!formats.includes('ean_13')) return null
    const detector = new Native({ formats })
    return { detect: (source) => detector.detect(source), native: true }
  } catch {
    return null
  }
}

async function ponyfillDetector(): Promise<Detector> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
  })
  const detector = new BarcodeDetector({ formats: [...RETAIL_FORMATS] })
  return { detect: (source) => detector.detect(source), native: false }
}

let cached: Promise<Detector> | null = null

export function getDetector(): Promise<Detector> {
  cached ??= nativeDetector().then((d) => d ?? ponyfillDetector())
  cached.catch(() => {
    cached = null
  })
  return cached
}
