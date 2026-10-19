import { BARCODE_VIDEO, VIDEO_BARCODE } from '../playwright.config'
import { writeBarcodeVideo } from './barcode-video'

export default function globalSetup() {
  writeBarcodeVideo(BARCODE_VIDEO, VIDEO_BARCODE)
}
