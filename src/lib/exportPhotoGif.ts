import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { PhotoCanvasSize, PhotoFrame } from '../types'
import { coverScale } from './photoFrames'

interface ExportPhotoGifOptions {
  frames: PhotoFrame[]
  canvas: PhotoCanvasSize
  fps: number
  scale: number
  transparentBackground: boolean
  backgroundColor: string
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    image.src = src
  })
}

export async function encodePhotoGif({
  frames,
  canvas,
  fps,
  scale,
  transparentBackground,
  backgroundColor,
}: ExportPhotoGifOptions): Promise<Uint8Array> {
  const gif = GIFEncoder()
  const width = canvas.width * scale
  const height = canvas.height * scale
  const delay = Math.round(1000 / fps)

  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = height
  const context = surface.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('CANVAS_UNAVAILABLE')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  // Cache decoded images so duplicated frames don't reload.
  const images = new Map<string, HTMLImageElement>()

  for (const frame of frames) {
    let image = images.get(frame.src)
    if (!image) {
      image = await loadImage(frame.src)
      images.set(frame.src, image)
    }

    if (transparentBackground) context.clearRect(0, 0, width, height)
    else {
      context.fillStyle = backgroundColor
      context.fillRect(0, 0, width, height)
    }

    const drawScale = coverScale(frame.naturalWidth, frame.naturalHeight, canvas) * scale
    context.drawImage(
      image,
      frame.offsetX * scale,
      frame.offsetY * scale,
      frame.naturalWidth * drawScale,
      frame.naturalHeight * drawScale,
    )

    const rgba = context.getImageData(0, 0, width, height).data
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

    gif.writeFrame(indexed, width, height, {
      palette,
      delay,
      repeat: 0,
      transparent: transparentBackground,
      transparentIndex,
      dispose: transparentBackground ? 2 : 0,
    })
  }

  gif.finish()
  return gif.bytes()
}
