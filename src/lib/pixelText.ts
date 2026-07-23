import type { Pixel, PixelTextBounds, PixelTextPlacement } from '../types'

export interface RenderedPixelText {
  pixels: Pixel[]
  bounds: PixelTextBounds
}

export function applyTextAlphaMask(
  pixels: Pixel[],
  alpha: Uint8ClampedArray,
  color: string,
  threshold = 72,
): Pixel[] {
  const next = pixels.slice()
  for (let index = 0; index < next.length; index += 1) {
    if (alpha[index] >= threshold) next[index] = color
  }
  return next
}

export function renderPixelText(
  pixels: Pixel[],
  resolution: number,
  placement: PixelTextPlacement,
): RenderedPixelText {
  const fallbackBounds: PixelTextBounds = {
    x: Math.max(0, Math.floor(placement.x)),
    y: Math.max(0, Math.floor(placement.y)),
    width: Math.max(1, Math.min(resolution, Math.ceil(placement.text.length * placement.fontSize * 0.62))),
    height: Math.max(1, Math.min(resolution, Math.ceil(placement.fontSize))),
  }

  if (typeof document === 'undefined') return { pixels: pixels.slice(), bounds: fallbackBounds }

  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return { pixels: pixels.slice(), bounds: fallbackBounds }

  context.clearRect(0, 0, resolution, resolution)
  context.font = `700 ${placement.fontSize}px Arial, sans-serif`
  context.textBaseline = 'top'
  context.fillStyle = '#ffffff'
  context.fillText(placement.text, Math.round(placement.x), Math.round(placement.y))

  let imageData: ImageData
  try {
    imageData = context.getImageData(0, 0, resolution, resolution)
  } catch {
    return { pixels: pixels.slice(), bounds: fallbackBounds }
  }

  const alpha = new Uint8ClampedArray(resolution * resolution)
  let minX = resolution
  let minY = resolution
  let maxX = -1
  let maxY = -1

  for (let index = 0; index < alpha.length; index += 1) {
    const value = imageData.data[index * 4 + 3]
    alpha[index] = value
    if (value < 72) continue
    const x = index % resolution
    const y = Math.floor(index / resolution)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  return {
    pixels: applyTextAlphaMask(pixels, alpha, placement.color),
    bounds:
      maxX >= minX && maxY >= minY
        ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
        : fallbackBounds,
  }
}
