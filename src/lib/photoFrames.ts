import type { PhotoCanvasSize, PhotoFrame } from '../types'
import { MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES } from './importImage'

/** Longest side of the GIF canvas. Caps encoding cost while honoring the first photo's aspect ratio. */
export const MAX_CANVAS_DIM = 512
/** Upper bound on photo frames — photos are heavier than pixel frames, so keep it modest. */
export const MAX_PHOTO_FRAMES = 60
/** Minimum fraction of each canvas axis that must stay covered by the photo, so it can never be panned fully off-screen. */
export const EDGE_KEEP = 0.2

export interface LoadedImage {
  src: string
  width: number
  height: number
}

/**
 * Read an image file into a data URL plus its natural dimensions.
 * Reuses the pixel importer's type/size guards (throws UNSUPPORTED_IMAGE / IMAGE_TOO_LARGE).
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) throw new Error('UNSUPPORTED_IMAGE')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE')

  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const { width, height } = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('UNSUPPORTED_IMAGE'))
      image.src = src
    },
  )

  return { src, width, height }
}

/** Derive the GIF canvas size from the first photo, scaling down so the longest side is at most MAX_CANVAS_DIM. */
export function computeCanvasSize(width: number, height: number): PhotoCanvasSize {
  const longest = Math.max(width, height)
  const scale = longest > MAX_CANVAS_DIM ? MAX_CANVAS_DIM / longest : 1
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Scale factor that makes an image cover the whole canvas (no gaps). */
export function coverScale(
  naturalWidth: number,
  naturalHeight: number,
  canvas: PhotoCanvasSize,
): number {
  return Math.max(canvas.width / naturalWidth, canvas.height / naturalHeight)
}

/** Draw dimensions of a cover-scaled image, in canvas coordinates. */
export function coverDimensions(frame: PhotoFrame, canvas: PhotoCanvasSize) {
  const scale = coverScale(frame.naturalWidth, frame.naturalHeight, canvas)
  return { width: frame.naturalWidth * scale, height: frame.naturalHeight * scale }
}

/**
 * Clamp a draw origin so the photo can be panned freely (gaps allowed) but can never
 * be pushed fully off-screen — at least EDGE_KEEP of each canvas axis stays covered.
 */
export function clampOffset(
  offsetX: number,
  offsetY: number,
  frame: Pick<PhotoFrame, 'naturalWidth' | 'naturalHeight'>,
  canvas: PhotoCanvasSize,
): { offsetX: number; offsetY: number } {
  const scale = coverScale(frame.naturalWidth, frame.naturalHeight, canvas)
  const scaledWidth = frame.naturalWidth * scale
  const scaledHeight = frame.naturalHeight * scale
  const keepX = canvas.width * EDGE_KEEP
  const keepY = canvas.height * EDGE_KEEP
  return {
    offsetX: Math.min(canvas.width - keepX, Math.max(keepX - scaledWidth, offsetX)),
    offsetY: Math.min(canvas.height - keepY, Math.max(keepY - scaledHeight, offsetY)),
  }
}

/** Centered draw origin for a freshly added photo. */
export function centeredOffset(
  naturalWidth: number,
  naturalHeight: number,
  canvas: PhotoCanvasSize,
): { offsetX: number; offsetY: number } {
  const scale = coverScale(naturalWidth, naturalHeight, canvas)
  return {
    offsetX: Math.round((canvas.width - naturalWidth * scale) / 2),
    offsetY: Math.round((canvas.height - naturalHeight * scale) / 2),
  }
}

/** Arrow-key / button pan step in canvas pixels, scaled a little to the canvas size. */
export function moveStep(canvas: PhotoCanvasSize): number {
  return Math.max(4, Math.round(Math.max(canvas.width, canvas.height) * 0.02))
}
