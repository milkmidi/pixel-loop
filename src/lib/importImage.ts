import type { Pixel } from '../types'

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export function calculateContainedRect(
  sourceWidth: number,
  sourceHeight: number,
  targetSize: number,
) {
  const scale = Math.min(targetSize / sourceWidth, targetSize / sourceHeight)
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  return {
    x: Math.floor((targetSize - width) / 2),
    y: Math.floor((targetSize - height) / 2),
    width,
    height,
  }
}

export function rgbaToPixels(rgba: Uint8ClampedArray, alphaThreshold = 128): Pixel[] {
  const pixels: Pixel[] = []
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (rgba[offset + 3] < alphaThreshold) {
      pixels.push(null)
      continue
    }
    const hex = [rgba[offset], rgba[offset + 1], rgba[offset + 2]]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
    pixels.push(`#${hex}`)
  }
  return pixels
}

export async function importImageFile(file: File, targetSize: number): Promise<Pixel[]> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('UNSUPPORTED_IMAGE')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('IMAGE_TOO_LARGE')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('CANVAS_UNAVAILABLE')

    const rect = calculateContainedRect(bitmap.width, bitmap.height, targetSize)
    context.clearRect(0, 0, targetSize, targetSize)
    context.imageSmoothingEnabled = false
    context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height)
    return rgbaToPixels(context.getImageData(0, 0, targetSize, targetSize).data)
  } finally {
    bitmap.close()
  }
}
