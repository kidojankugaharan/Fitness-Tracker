import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// Renders an EAN-13 barcode into a .y4m video so Chrome's fake camera
// (--use-file-for-fake-video-capture) "sees" a real barcode and the scanner decodes it for real.

const L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
]
const G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
]
const R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
]
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLG',
  'LGLGGL',
  'LGLGLG',
  'LGGLGL',
]

/** The 95-module bit pattern of an EAN-13 code. */
export function ean13Modules(code: string): string {
  const d = code.split('').map(Number)
  const parity = PARITY[d[0]!]!
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[d[i]!]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[d[i]!]
  return bits + '101'
}

export function writeBarcodeVideo(path: string, code: string) {
  const width = 640
  const height = 480
  const moduleWidth = 4
  const modules = ean13Modules(code)
  const barsWidth = modules.length * moduleWidth
  const left = Math.floor((width - barsWidth) / 2)
  const top = 140
  const barHeight = 200

  // Y plane: white background with black bars; U/V planes neutral grey (4:2:0).
  const y = Buffer.alloc(width * height, 235)
  for (let row = top; row < top + barHeight; row++) {
    for (let m = 0; m < modules.length; m++) {
      if (modules[m] !== '1') continue
      const x0 = left + m * moduleWidth
      y.fill(16, row * width + x0, row * width + x0 + moduleWidth)
    }
  }
  const uv = Buffer.alloc((width / 2) * (height / 2), 128)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, uv, uv])
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`)

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, Buffer.concat([header, ...Array.from({ length: 10 }, () => frame)]))
}
