import type { Pixel } from '../types'

export function createBlankPixels(size: number): Pixel[] {
  return Array<Pixel>(size * size).fill(null)
}

export function pixelsEqual(a: Pixel[], b: Pixel[]): boolean {
  if (a.length !== b.length) return false
  return a.every((pixel, index) => pixel === b[index])
}

export function normalizeHex(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized
  if (/^[0-9a-f]{6}$/.test(normalized)) return `#${normalized}`
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    const [r, g, b] = normalized.slice(1)
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex) ?? '#000000'
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ]
}

export function drawLineIndices(
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
): number[] {
  let x0 = from.x
  let y0 = from.y
  const x1 = to.x
  const y1 = to.y
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  const indices: number[] = []

  while (true) {
    if (x0 >= 0 && x0 < size && y0 >= 0 && y0 < size) {
      indices.push(y0 * size + x0)
    }
    if (x0 === x1 && y0 === y1) break
    const twiceError = 2 * error
    if (twiceError >= dy) {
      error += dy
      x0 += sx
    }
    if (twiceError <= dx) {
      error += dx
      y0 += sy
    }
  }

  return indices
}

export function pixelsToRgba(
  pixels: Pixel[],
  size: number,
  scale: number,
  transparentBackground: boolean,
  backgroundColor: string,
): Uint8ClampedArray {
  const outputSize = size * scale
  const rgba = new Uint8ClampedArray(outputSize * outputSize * 4)
  const background = hexToRgb(backgroundColor)

  for (let y = 0; y < outputSize; y += 1) {
    for (let x = 0; x < outputSize; x += 1) {
      const sourceX = Math.floor(x / scale)
      const sourceY = Math.floor(y / scale)
      const pixel = pixels[sourceY * size + sourceX]
      const offset = (y * outputSize + x) * 4
      const [r, g, b] = pixel ? hexToRgb(pixel) : background

      rgba[offset] = r
      rgba[offset + 1] = g
      rgba[offset + 2] = b
      rgba[offset + 3] = pixel || !transparentBackground ? 255 : 0
    }
  }

  return rgba
}

export function hasPaint(pixels: Pixel[]): boolean {
  return pixels.some(Boolean)
}
