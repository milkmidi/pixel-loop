import { useEffect, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle } from 'lucide-react'
import type { DrawingTool, Pixel } from '../types'
import { drawLineIndices } from '../lib/pixels'

interface PixelCanvasProps {
  pixels: Pixel[]
  resolution: number
  zoom: number
  showGrid: boolean
  tool: DrawingTool
  onStrokeStart: () => void
  onDraw: (indices: number[], forceErase?: boolean) => void
  onStrokeEnd: () => void
  onPick: (pixel: Pixel) => void
  onImageDrop: (file: File) => void
  isImporting: boolean
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
  onImageDrop,
  isImporting,
}: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activePointerRef = useRef<number | null>(null)
  const activeEraseRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const dragDepthRef = useRef(0)
  const [isDraggingImage, setIsDraggingImage] = useState(false)

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
    const isMouse = event.pointerType === 'mouse'
    const isRightClick = isMouse && event.button === 2
    if (isMouse && event.button !== 0 && !isRightClick) return
    const point = pointFromEvent(event)

    if (tool === 'eyedropper' && !isRightClick) {
      onPick(pixels[point.y * resolution + point.x])
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointerRef.current = event.pointerId
    activeEraseRef.current = isRightClick
    lastPointRef.current = point
    onStrokeStart()
    onDraw([point.y * resolution + point.x], isRightClick)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId || !lastPointRef.current) return
    event.preventDefault()
    const point = pointFromEvent(event)
    const indices = drawLineIndices(lastPointRef.current, point, resolution)
    onDraw(indices, activeEraseRef.current)
    lastPointRef.current = point
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerRef.current !== event.pointerId) return
    activePointerRef.current = null
    activeEraseRef.current = false
    lastPointRef.current = null
    onStrokeEnd()
  }

  const displaySize = resolution * zoom

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingImage(true)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDraggingImage(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingImage(false)
    const file = Array.from(event.dataTransfer.files).find((item) =>
      item.type.startsWith('image/'),
    )
    if (file) onImageDrop(file)
  }

  return (
    <div
      className="canvas-checker relative shrink-0 overflow-hidden rounded-sm shadow-[0_24px_60px_rgba(26,26,46,0.16)] ring-1 ring-black/10"
      style={{ width: displaySize, height: displaySize }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        width={resolution}
        height={resolution}
        aria-label={`${resolution} by ${resolution} pixel drawing canvas`}
        className={`absolute inset-0 h-full w-full touch-none select-none [image-rendering:pixelated] ${
          tool === 'eyedropper' ? 'cursor-crosshair' : 'cursor-cell'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onContextMenu={(event) => event.preventDefault()}
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
      {(isDraggingImage || isImporting) && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#4ade80] bg-[#1a1a2e]/88 text-center text-white shadow-2xl backdrop-blur-sm">
          {isImporting ? (
            <LoaderCircle size={30} className="mb-3 animate-spin text-[#4ade80]" />
          ) : (
            <ImagePlus size={30} className="mb-3 text-[#4ade80]" />
          )}
          <strong className="text-sm font-bold">
            {isImporting ? 'Parsing image…' : 'Drop image to pixelate'}
          </strong>
          <span className="mt-1 text-[10px] text-white/55">
            PNG · JPG · WebP · GIF first frame
          </span>
        </div>
      )}
    </div>
  )
}
