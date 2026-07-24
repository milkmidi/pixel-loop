import { useEffect, useRef } from 'react'
import type { PhotoCanvasSize, PhotoFrame } from '../types'
import { coverScale } from '../lib/photoFrames'

interface PhotoFramePreviewProps {
  frame: PhotoFrame
  canvas: PhotoCanvasSize
  className?: string
  label?: string
}

export function PhotoFramePreview({
  frame,
  canvas,
  className = '',
  label = 'Photo frame preview',
}: PhotoFramePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvasRef.current
    const context = element?.getContext('2d')
    if (!element || !context) return

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      const scale = coverScale(frame.naturalWidth, frame.naturalHeight, canvas)
      context.imageSmoothingEnabled = true
      context.drawImage(
        image,
        frame.offsetX,
        frame.offsetY,
        frame.naturalWidth * scale,
        frame.naturalHeight * scale,
      )
    }
    image.src = frame.src

    return () => {
      cancelled = true
    }
  }, [frame.src, frame.offsetX, frame.offsetY, frame.naturalWidth, frame.naturalHeight, canvas.width, canvas.height])

  return (
    <div className={`canvas-checker flex items-center justify-center overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={canvas.width}
        height={canvas.height}
        aria-label={label}
        className="h-full w-full object-contain"
      />
    </div>
  )
}
