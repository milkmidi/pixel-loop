import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { Pixel } from '../types'
import { pixelsToRgba } from './pixels'

interface ExportGifOptions {
  frames: Pixel[][]
  resolution: number
  scale: number
  fps: number
  transparentBackground: boolean
  backgroundColor: string
}

export function encodeGif({
  frames,
  resolution,
  scale,
  fps,
  transparentBackground,
  backgroundColor,
}: ExportGifOptions): Uint8Array {
  const gif = GIFEncoder()
  const outputSize = resolution * scale
  const delay = Math.round(1000 / fps)

  frames.forEach((pixels) => {
    const rgba = pixelsToRgba(
      pixels,
      resolution,
      scale,
      transparentBackground,
      backgroundColor,
    )
    const format = transparentBackground ? 'rgba4444' : 'rgb565'
    const palette = quantize(rgba, 256, {
      format,
      oneBitAlpha: transparentBackground,
      clearAlpha: transparentBackground,
    })
    const indexed = applyPalette(rgba, palette, format)
    const transparentIndex = transparentBackground
      ? Math.max(
          0,
          palette.findIndex((entry) => entry.length === 4 && entry[3] === 0),
        )
      : 0

    gif.writeFrame(indexed, outputSize, outputSize, {
      palette,
      delay,
      repeat: 0,
      transparent: transparentBackground,
      transparentIndex,
      dispose: transparentBackground ? 2 : 0,
    })
  })

  gif.finish()
  return gif.bytes()
}

export function downloadGif(bytes: Uint8Array, filename = 'pixel-loop.gif'): void {
  const blob = new Blob([bytes as BlobPart], { type: 'image/gif' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
