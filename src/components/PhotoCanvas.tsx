import { useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, Move } from 'lucide-react'
import type { PhotoCanvasSize, PhotoFrame } from '../types'
import { coverScale } from '../lib/photoFrames'

interface PhotoCanvasProps {
  frame: PhotoFrame | null
  canvas: PhotoCanvasSize | null
  onMove: (dx: number, dy: number) => void
  onUpload: (files: File[]) => void
  isImporting: boolean
}

const MAX_DISPLAY_WIDTH = 540
const MAX_DISPLAY_HEIGHT = 460

export function PhotoCanvas({ frame, canvas, onMove, onUpload, isImporting }: PhotoCanvasProps) {
  const activePointerRef = useRef<number | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const dragDepthRef = useRef(0)
  const [isDraggingImage, setIsDraggingImage] = useState(false)

  const displayScale = canvas
    ? Math.min(MAX_DISPLAY_WIDTH / canvas.width, MAX_DISPLAY_HEIGHT / canvas.height)
    : 1
  const displayWidth = canvas ? canvas.width * displayScale : MAX_DISPLAY_WIDTH
  const displayHeight = canvas ? canvas.height * displayScale : 320

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!frame || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointerRef.current = event.pointerId
    lastPointRef.current = { x: event.clientX, y: event.clientY }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId || !lastPointRef.current) return
    event.preventDefault()
    const dx = (event.clientX - lastPointRef.current.x) / displayScale
    const dy = (event.clientY - lastPointRef.current.y) / displayScale
    lastPointRef.current = { x: event.clientX, y: event.clientY }
    onMove(dx, dy)
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return
    activePointerRef.current = null
    lastPointRef.current = null
  }

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
    const files = Array.from(event.dataTransfer.files).filter((item) =>
      item.type.startsWith('image/'),
    )
    if (files.length) onUpload(files)
  }

  const cover = frame && canvas ? coverScale(frame.naturalWidth, frame.naturalHeight, canvas) : 1

  return (
    <div
      className={`canvas-checker relative shrink-0 touch-none select-none overflow-hidden rounded-sm shadow-[0_24px_60px_rgba(26,26,46,0.16)] ring-1 ring-black/10 ${
        frame ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={{ width: displayWidth, height: displayHeight }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {frame && canvas ? (
        <img
          src={frame.src}
          alt="Current frame"
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none cursor-grab active:cursor-grabbing"
          style={{
            left: frame.offsetX * displayScale,
            top: frame.offsetY * displayScale,
            width: frame.naturalWidth * cover * displayScale,
            height: frame.naturalHeight * cover * displayScale,
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
          <ImagePlus size={30} className="text-slate-300" />
          <strong className="text-sm font-bold text-slate-500">Drop photos to start</strong>
          <span className="text-[11px] text-slate-400">
            The first photo sets the GIF size. Each photo becomes a frame.
          </span>
        </div>
      )}

      {frame && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-[#1a1a2e]/75 px-2 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-sm">
          <Move size={11} /> Drag or use arrows to reposition
        </div>
      )}

      {(isDraggingImage || isImporting) && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#4ade80] bg-[#1a1a2e]/88 text-center text-white shadow-2xl backdrop-blur-sm">
          {isImporting ? (
            <LoaderCircle size={30} className="mb-3 animate-spin text-[#4ade80]" />
          ) : (
            <ImagePlus size={30} className="mb-3 text-[#4ade80]" />
          )}
          <strong className="text-sm font-bold">
            {isImporting ? 'Adding photos…' : 'Drop photos to add frames'}
          </strong>
          <span className="mt-1 text-[10px] text-white/55">PNG · JPG · WebP · GIF</span>
        </div>
      )}
    </div>
  )
}
