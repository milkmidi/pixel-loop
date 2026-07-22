import { useEffect, useRef } from 'react'
import type { DrawingTool, Pixel } from '../types'
import { drawLineIndices } from '../lib/pixels'

interface PixelCanvasProps {
  pixels: Pixel[]
  resolution: number
  zoom: number
  showGrid: boolean
  tool: DrawingTool
  onStrokeStart: () => void
  onDraw: (indices: number[]) => void
  onStrokeEnd: () => void
  onPick: (pixel: Pixel) => void
}

export function PixelCanvas({
  pixels,
  resolution,
  zoom,
  showGrid,
  tool,
  onStrokeStart,
  onDraw,
  onStrokeEnd,
  onPick,
}: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, resolution, resolution)
    pixels.forEach((pixel, index) => {
      if (!pixel) return
      context.fillStyle = pixel
      context.fillRect(index % resolution, Math.floor(index / resolution), 1, 1)
    })
  }, [pixels, resolution])

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(
        resolution - 1,
        Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * resolution)),
      ),
      y: Math.min(
        resolution - 1,
        Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * resolution)),
      ),
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const point = pointFromEvent(event)

    if (tool === 'eyedropper') {
      onPick(pixels[point.y * resolution + point.x])
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointerRef.current = event.pointerId
    lastPointRef.current = point
    onStrokeStart()
    onDraw([point.y * resolution + point.x])
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId || !lastPointRef.current) return
    event.preventDefault()
    const point = pointFromEvent(event)
    const indices = drawLineIndices(lastPointRef.current, point, resolution)
    onDraw(indices)
    lastPointRef.current = point
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) return
    activePointerRef.current = null
    lastPointRef.current = null
    onStrokeEnd()
  }

  const displaySize = resolution * zoom

  return (
    <div
      className="canvas-checker relative shrink-0 overflow-hidden rounded-sm shadow-[0_24px_60px_rgba(26,26,46,0.16)] ring-1 ring-black/10"
      style={{ width: displaySize, height: displaySize }}
    >
      <canvas
        ref={canvasRef}
        width={resolution}
        height={resolution}
        aria-label={`${resolution} 乘 ${resolution} 像素繪圖畫布`}
        className={`absolute inset-0 h-full w-full touch-none select-none [image-rendering:pixelated] ${
          tool === 'eyedropper' ? 'cursor-crosshair' : 'cursor-cell'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, #1a1a2e 1px, transparent 1px), linear-gradient(to bottom, #1a1a2e 1px, transparent 1px)',
            backgroundSize: `${zoom}px ${zoom}px`,
          }}
        />
      )}
    </div>
  )
}
