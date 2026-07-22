import { useEffect, useRef } from 'react'
import type { Pixel } from '../types'

interface PixelPreviewProps {
  pixels: Pixel[]
  resolution: number
  className?: string
  label?: string
}

export function PixelPreview({
  pixels,
  resolution,
  className = '',
  label = 'Pixel art preview',
}: PixelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, resolution, resolution)
    pixels.forEach((pixel, index) => {
      if (!pixel) return
      context.fillStyle = pixel
      context.fillRect(index % resolution, Math.floor(index / resolution), 1, 1)
    })
  }, [pixels, resolution])

  return (
    <div className={`canvas-checker overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={resolution}
        height={resolution}
        aria-label={label}
        className="h-full w-full [image-rendering:pixelated]"
      />
    </div>
  )
}
