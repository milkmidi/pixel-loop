import { useEffect, useMemo, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Braces,
  Camera,
  Check,
  Download,
  Eraser,
  Film,
  FolderX,
  Grid3X3,
  LoaderCircle,
  ImagePlus,
  Locate,
  Pause,
  Pencil,
  Pipette,
  Play,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  WandSparkles,
} from 'lucide-react'
import { ExportDialog } from './components/ExportDialog'
import { ImportAnimationDialog } from './components/ImportAnimationDialog'
import { PhotoCanvas } from './components/PhotoCanvas'
import { PhotoFramePreview } from './components/PhotoFramePreview'
import { PixelCanvas } from './components/PixelCanvas'
import { PixelPreview } from './components/PixelPreview'
import { Timeline } from './components/Timeline'
import { downloadGif, encodeGif } from './lib/exportGif'
import { encodePhotoGif } from './lib/exportPhotoGif'
import { importImageFile } from './lib/importImage'
import {
  MAX_PHOTO_FRAMES,
  centeredOffset,
  clampOffset,
  computeCanvasSize,
  loadImageFile,
  moveStep,
} from './lib/photoFrames'
import { renderPixelText } from './lib/pixelText'
import type { ParsedAnimation } from './lib/importAnimationJson'
import {
  createBlankPixels,
  hasPaint,
  normalizeHex,
  pixelsEqual,
  shiftPixels,
  type PixelShiftDirection,
} from './lib/pixels'
import { loadProject, saveProject } from './lib/storage'
import { usePixelHistory } from './hooks/usePixelHistory'
import {
  RESOLUTIONS,
  type AnimationFrame,
  type AppMode,
  type DrawingTool,
  type Pixel,
  type PhotoCanvasSize,
  type PhotoFrame,
  type PixelTextPlacement,
  type ProjectState,
  type Resolution,
} from './types'

const PHOTO_MOVE_OFFSETS: Record<PixelShiftDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
/** Keep photo GIF output within a sane pixel budget regardless of the chosen export scale. */
const MAX_PHOTO_EXPORT_DIM = 1024

const DEFAULT_COLOR = '#16a34a'
const COLOR_PRESETS = ['#1a1a2e', '#16a34a', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7']
const ZOOM_OPTIONS: Record<Resolution, number[]> = {
  16: [12, 16, 20, 24, 28],
  32: [6, 8, 10, 12, 14],
  64: [4, 6, 8, 10],
}

const defaultProject = (): ProjectState => ({
  version: 1,
  resolution: 16,
  pixels: createBlankPixels(16),
  baselinePixels: createBlankPixels(16),
  frames: [],
  editingFrameId: null,
  color: DEFAULT_COLOR,
  fps: 8,
  exportScale: 4,
  zoom: 24,
  showGrid: true,
  transparentBackground: true,
  backgroundColor: '#ffffff',
  mode: 'draw',
  photoCanvas: null,
  photoFrames: [],
})

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function defaultZoomForResolution(resolution: Resolution): number {
  if (resolution === 16) return 24
  if (resolution === 32) return 12
  return 6
}

function isTextInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  )
}

export default function App() {
  const initial = useRef(defaultProject()).current
  const [resolution, setResolution] = useState<Resolution>(initial.resolution)
  const {
    pixels,
    setPixels,
    beginStroke: handleStrokeStart,
    endStroke: handleStrokeEnd,
    commitPixels,
    undo,
    redo,
    resetHistory,
    canUndo,
    canRedo,
  } = usePixelHistory(initial.pixels)
  const [baselinePixels, setBaselinePixels] = useState<Pixel[]>(initial.baselinePixels)
  const [frames, setFrames] = useState<AnimationFrame[]>(initial.frames)
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null)
  const [mode, setMode] = useState<AppMode>('draw')
  const [photoCanvas, setPhotoCanvas] = useState<PhotoCanvasSize | null>(null)
  const [photoFrames, setPhotoFrames] = useState<PhotoFrame[]>([])
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [tool, setTool] = useState<DrawingTool>('pencil')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [colorDraft, setColorDraft] = useState(DEFAULT_COLOR)
  const [textValue, setTextValue] = useState('')
  const [textFontSize, setTextFontSize] = useState(7)
  const [textDraft, setTextDraft] = useState<PixelTextPlacement | null>(null)
  const [fps, setFps] = useState(8)
  const [exportScale, setExportScale] = useState(4)
  const [zoom, setZoom] = useState(initial.zoom)
  const [showGrid, setShowGrid] = useState(true)
  const [transparentBackground, setTransparentBackground] = useState(true)
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>(
    'loading',
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showImportAnimation, setShowImportAnimation] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const renderedText = useMemo(
    () => (textDraft ? renderPixelText(pixels, resolution, textDraft) : null),
    [pixels, resolution, textDraft],
  )
  const displayPixels = renderedText?.pixels ?? pixels
  const dirty = useMemo(
    () => Boolean(textDraft) || !pixelsEqual(pixels, baselinePixels),
    [pixels, baselinePixels, textDraft],
  )
  const photoMode = mode === 'gif'
  const selectedPhoto = useMemo(
    () => photoFrames.find((frame) => frame.id === selectedPhotoId) ?? null,
    [photoFrames, selectedPhotoId],
  )
  const timelineLength = photoMode ? photoFrames.length : frames.length
  // Photo GIFs are capped to a sane longest side regardless of the chosen scale.
  const photoExportScale = photoCanvas
    ? Math.max(
        1,
        Math.min(exportScale, Math.floor(MAX_PHOTO_EXPORT_DIM / Math.max(photoCanvas.width, photoCanvas.height))),
      )
    : exportScale

  useEffect(() => {
    let cancelled = false
    loadProject()
      .then((project) => {
        if (cancelled || !project || project.version !== 1) return
        if (!RESOLUTIONS.includes(project.resolution)) return
        if (project.pixels.length !== project.resolution * project.resolution) return

        setResolution(project.resolution)
        setPixels(project.pixels)
        setBaselinePixels(project.baselinePixels ?? project.pixels)
        setFrames(project.frames ?? [])
        setEditingFrameId(project.editingFrameId ?? null)
        setColor(project.color ?? DEFAULT_COLOR)
        setColorDraft(project.color ?? DEFAULT_COLOR)
        setFps(project.fps ?? 8)
        setExportScale(project.exportScale ?? 4)
        setZoom(project.zoom ?? defaultZoomForResolution(project.resolution))
        setShowGrid(project.showGrid ?? true)
        setTransparentBackground(project.transparentBackground ?? true)
        setBackgroundColor(project.backgroundColor ?? '#ffffff')
        setMode(project.mode === 'gif' ? 'gif' : 'draw')
        setPhotoCanvas(project.photoCanvas ?? null)
        setPhotoFrames(project.photoFrames ?? [])
        setSelectedPhotoId(project.photoFrames?.[0]?.id ?? null)
      })
      .catch(() => setSaveStatus('error'))
      .finally(() => {
        if (!cancelled) {
          setHydrated(true)
          setSaveStatus('saved')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      saveProject({
        version: 1,
        resolution,
        pixels,
        baselinePixels,
        frames,
        editingFrameId,
        color,
        fps,
        exportScale,
        zoom,
        showGrid,
        transparentBackground,
        backgroundColor,
        mode,
        photoCanvas,
        photoFrames,
      })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'))
    }, 450)

    return () => window.clearTimeout(timer)
  }, [
    hydrated,
    resolution,
    pixels,
    baselinePixels,
    frames,
    editingFrameId,
    color,
    fps,
    exportScale,
    zoom,
    showGrid,
    transparentBackground,
    backgroundColor,
    mode,
    photoCanvas,
    photoFrames,
  ])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!isPlaying || timelineLength < 2) return
    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % timelineLength)
    }, 1000 / fps)
    return () => window.clearInterval(timer)
  }, [isPlaying, timelineLength, fps])

  useEffect(() => {
    if (previewIndex >= timelineLength) setPreviewIndex(Math.max(0, timelineLength - 1))
    if (timelineLength < 2) setIsPlaying(false)
  }, [timelineLength, previewIndex])

  function handleDraw(indices: number[], forceErase = false) {
    const nextColor = forceErase || tool === 'eraser' ? null : color
    setPixels((current) => {
      const next = current.slice()
      indices.forEach((index) => {
        next[index] = nextColor
      })
      return next
    })
  }

  function placeText() {
    if (!textValue.trim()) {
      setToast('Enter some text first')
      return
    }

    const initialPlacement: PixelTextPlacement = {
      text: textValue,
      x: 0,
      y: 0,
      fontSize: textFontSize,
      color,
    }
    const initialRender = renderPixelText(pixels, resolution, initialPlacement)
    const x = Math.floor((resolution - initialRender.bounds.width) / 2) - initialRender.bounds.x
    const y = Math.floor((resolution - initialRender.bounds.height) / 2) - initialRender.bounds.y
    setTextDraft({ ...initialPlacement, x, y })
    setTool('text')
  }

  function moveText(x: number, y: number) {
    setTextDraft((current) => {
      if (!current || !renderedText) return current
      const offsetX = renderedText.bounds.x - current.x
      const offsetY = renderedText.bounds.y - current.y
      return {
        ...current,
        x: Math.max(-offsetX, Math.min(resolution - renderedText.bounds.width - offsetX, x)),
        y: Math.max(-offsetY, Math.min(resolution - renderedText.bounds.height - offsetY, y)),
      }
    })
  }

  function applyText() {
    if (!textDraft || !renderedText) return
    commitPixels(renderedText.pixels)
    setTextDraft(null)
    setToast('Text added to the canvas')
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (showImportAnimation || showExportDialog) return
      if (photoMode) {
        // Only bail for real text fields — buttons (e.g. a just-clicked timeline
        // frame or nudge arrow) keep focus, and arrows must still pan from there.
        const target = event.target
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        ) {
          return
        }
        const photoDirections: Partial<Record<string, PixelShiftDirection>> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        }
        const direction = photoDirections[event.key]
        if (direction && selectedPhoto && photoCanvas) {
          event.preventDefault()
          const step = moveStep(photoCanvas)
          movePhoto(
            selectedPhoto.id,
            PHOTO_MOVE_OFFSETS[direction].x * step,
            PHOTO_MOVE_OFFSETS[direction].y * step,
          )
        }
        return
      }
      if (isTextInput(event.target)) return
      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (!command && event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        snapshot()
        return
      }
      const arrowDirections: Partial<Record<string, PixelShiftDirection>> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      }
      const direction = arrowDirections[event.key]
      if (!command && !event.altKey && direction) {
        event.preventDefault()
        if (tool === 'text' && textDraft) {
          const offsets: Record<PixelShiftDirection, { x: number; y: number }> = {
            up: { x: 0, y: -1 },
            down: { x: 0, y: 1 },
            left: { x: -1, y: 0 },
            right: { x: 1, y: 0 },
          }
          moveText(textDraft.x + offsets[direction].x, textDraft.y + offsets[direction].y)
          return
        }
        commitPixels((current) => shiftPixels(current, resolution, direction))
        return
      }
      if (!command && event.key.toLowerCase() === 'p') setTool('pencil')
      if (!command && event.key.toLowerCase() === 'e') setTool('eraser')
      if (!command && event.key.toLowerCase() === 'i') setTool('eyedropper')
      if (!command && event.key.toLowerCase() === 't') setTool('text')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function pickColor(pixel: Pixel) {
    if (!pixel) {
      setToast('This pixel is transparent')
      return
    }
    setColor(pixel)
    setColorDraft(pixel)
    setTool('pencil')
    setToast(`Picked ${pixel.toUpperCase()}`)
  }

  function applyColorDraft() {
    const normalized = normalizeHex(colorDraft)
    if (!normalized) {
      setColorDraft(color)
      setToast('Enter a valid hex color')
      return
    }
    setColor(normalized)
    setColorDraft(normalized)
  }

  async function processImageFile(file: File) {
    if (isImporting) return
    if (hasPaint(pixels) && !window.confirm('Importing an image will replace the current canvas. Continue?')) {
      return
    }

    setIsImporting(true)
    try {
      const importedPixels = await importImageFile(file, resolution)
      commitPixels(importedPixels)
      setTextDraft(null)
      setTool('pencil')
      setToast(`Imported ${file.name}`)
    } catch (error) {
      if (error instanceof Error && error.message === 'IMAGE_TOO_LARGE') {
        setToast('Images must be smaller than 20 MB')
      } else if (error instanceof Error && error.message === 'UNSUPPORTED_IMAGE') {
        setToast('Only PNG, JPG, WebP, and GIF files are supported')
      } else {
        console.error(error)
        setToast('Could not parse this image. Try another file')
      }
    } finally {
      setIsImporting(false)
    }
  }

  async function handleImageImport(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (file) await processImageFile(file)
    input.value = ''
  }

  function switchMode(nextMode: AppMode) {
    if (nextMode === mode) return
    setMode(nextMode)
    setIsPlaying(false)
    setPreviewIndex(0)
    setToast(nextMode === 'gif' ? 'GIF maker mode' : 'Pixel draw mode')
  }

  async function addPhotoFiles(files: File[]) {
    if (isImporting) return
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return

    const remaining = MAX_PHOTO_FRAMES - photoFrames.length
    if (remaining <= 0) {
      setToast(`The ${MAX_PHOTO_FRAMES}-frame limit has been reached`)
      return
    }
    const batch = images.slice(0, remaining)

    setIsImporting(true)
    try {
      let workingCanvas = photoCanvas
      const created: PhotoFrame[] = []
      for (const file of batch) {
        const loaded = await loadImageFile(file)
        if (!workingCanvas) workingCanvas = computeCanvasSize(loaded.width, loaded.height)
        const offset = centeredOffset(loaded.width, loaded.height, workingCanvas)
        created.push({
          id: newId(),
          src: loaded.src,
          naturalWidth: loaded.width,
          naturalHeight: loaded.height,
          offsetX: offset.offsetX,
          offsetY: offset.offsetY,
          createdAt: Date.now() + created.length,
        })
      }

      if (!photoCanvas && workingCanvas) setPhotoCanvas(workingCanvas)
      const firstNewIndex = photoFrames.length
      setPhotoFrames((current) => [...current, ...created])
      if (!selectedPhotoId) setSelectedPhotoId(created[0]?.id ?? null)
      if (photoFrames.length === 0) setPreviewIndex(firstNewIndex)

      const label = created.length === 1 ? '1 photo' : `${created.length} photos`
      setToast(
        images.length > remaining ? `Added ${label} · frame limit reached` : `Added ${label}`,
      )
    } catch (error) {
      if (error instanceof Error && error.message === 'IMAGE_TOO_LARGE') {
        setToast('Images must be smaller than 20 MB')
      } else if (error instanceof Error && error.message === 'UNSUPPORTED_IMAGE') {
        setToast('Only PNG, JPG, WebP, and GIF files are supported')
      } else {
        console.error(error)
        setToast('Could not load this image. Try another file')
      }
    } finally {
      setIsImporting(false)
    }
  }

  async function handlePhotoInput(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = Array.from(input.files ?? [])
    if (files.length > 0) await addPhotoFiles(files)
    input.value = ''
  }

  function movePhoto(id: string, dx: number, dy: number) {
    if (!photoCanvas) return
    setPhotoFrames((current) =>
      current.map((frame) => {
        if (frame.id !== id) return frame
        const clamped = clampOffset(frame.offsetX + dx, frame.offsetY + dy, frame, photoCanvas)
        return { ...frame, ...clamped }
      }),
    )
  }

  function resetPhotoPosition(id: string) {
    if (!photoCanvas) return
    setPhotoFrames((current) =>
      current.map((frame) => {
        if (frame.id !== id) return frame
        const offset = centeredOffset(frame.naturalWidth, frame.naturalHeight, photoCanvas)
        return { ...frame, ...offset }
      }),
    )
  }

  function selectPhoto(frame: PhotoFrame) {
    setSelectedPhotoId(frame.id)
    setPreviewIndex(Math.max(0, photoFrames.findIndex((item) => item.id === frame.id)))
  }

  function deletePhotoFrame(id: string) {
    const index = photoFrames.findIndex((frame) => frame.id === id)
    if (index < 0) return
    const next = photoFrames.filter((frame) => frame.id !== id)
    setPhotoFrames(next)
    if (selectedPhotoId === id) setSelectedPhotoId(next[Math.max(0, index - 1)]?.id ?? null)
    if (next.length === 0) setPhotoCanvas(null)
    setToast(`Deleted Frame ${index + 1}`)
  }

  function duplicatePhotoFrame(id: string) {
    if (photoFrames.length >= MAX_PHOTO_FRAMES) {
      setToast(`The ${MAX_PHOTO_FRAMES}-frame limit has been reached`)
      return
    }
    const index = photoFrames.findIndex((frame) => frame.id === id)
    if (index < 0) return
    const duplicate: PhotoFrame = { ...photoFrames[index], id: newId(), createdAt: Date.now() }
    const next = photoFrames.slice()
    next.splice(index + 1, 0, duplicate)
    setPhotoFrames(next)
    setToast('Frame duplicated')
  }

  function reorderPhotoFrames(activeId: string, overId: string) {
    setPhotoFrames((current) => {
      const oldIndex = current.findIndex((frame) => frame.id === activeId)
      const newIndex = current.findIndex((frame) => frame.id === overId)
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex)
    })
  }

  async function exportPhotos() {
    if (!photoCanvas || photoFrames.length === 0) {
      setToast('Upload at least one photo first')
      return
    }
    setIsExporting(true)
    try {
      const bytes = await encodePhotoGif({
        frames: photoFrames,
        canvas: photoCanvas,
        fps,
        scale: photoExportScale,
        transparentBackground,
        backgroundColor,
      })
      const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
      downloadGif(bytes, `pixel-loop-gif-${stamp}.gif`)
      setToast(
        `GIF exported with ${photoFrames.length} frame${photoFrames.length === 1 ? '' : 's'}`,
      )
    } catch (error) {
      console.error(error)
      setToast('GIF export failed. Please try again')
    } finally {
      setIsExporting(false)
    }
  }

  function nudgePhoto(direction: PixelShiftDirection) {
    if (!selectedPhoto || !photoCanvas) return
    const step = moveStep(photoCanvas)
    movePhoto(
      selectedPhoto.id,
      PHOTO_MOVE_OFFSETS[direction].x * step,
      PHOTO_MOVE_OFFSETS[direction].y * step,
    )
  }

  function clearPhotos() {
    if (photoFrames.length === 0) return
    if (!window.confirm('Remove all photo frames? This cannot be undone.')) return
    setPhotoFrames([])
    setPhotoCanvas(null)
    setSelectedPhotoId(null)
    setPreviewIndex(0)
    setIsPlaying(false)
    setToast('All frames cleared')
  }

  function importAnimation(animation: ParsedAnimation) {
    if (
      (hasPaint(pixels) || frames.length > 0) &&
      !window.confirm('Importing this animation will replace the current project. Continue?')
    ) {
      return
    }

    const importedFrames: AnimationFrame[] = animation.frames.map((framePixels, index) => ({
      id: newId(),
      pixels: framePixels.slice(),
      createdAt: Date.now() + index,
    }))
    const firstFrame = importedFrames[0]
    const firstPaletteColor = Object.values(animation.palette)[0] ?? DEFAULT_COLOR

    setResolution(animation.resolution)
    setPixels(firstFrame.pixels.slice())
    setBaselinePixels(firstFrame.pixels.slice())
    setFrames(importedFrames)
    setEditingFrameId(firstFrame.id)
    setTextDraft(null)
    setTool('pencil')
    setColor(firstPaletteColor)
    setColorDraft(firstPaletteColor)
    setFps(animation.fps)
    setExportScale(4)
    setZoom(defaultZoomForResolution(animation.resolution))
    setShowGrid(true)
    setTransparentBackground(animation.transparentBackground)
    setBackgroundColor(animation.backgroundColor)
    setIsPlaying(false)
    setPreviewIndex(0)
    setShowExportDialog(false)
    setShowImportAnimation(false)
    resetHistory()
    setToast(
      `Imported ${importedFrames.length} frame${importedFrames.length === 1 ? '' : 's'} from JSON`,
    )
  }

  function changeResolution(nextResolution: Resolution) {
    if (nextResolution === resolution) return
    if (
      (hasPaint(pixels) || frames.length > 0) &&
      !window.confirm('Changing the size will clear the canvas and all frames. Continue?')
    ) {
      return
    }
    const blank = createBlankPixels(nextResolution)
    setResolution(nextResolution)
    setPixels(blank)
    setBaselinePixels(blank.slice())
    setFrames([])
    setEditingFrameId(null)
    setTextDraft(null)
    setTextFontSize(Math.max(4, Math.round(nextResolution * 0.44)))
    setPreviewIndex(0)
    setZoom(defaultZoomForResolution(nextResolution))
    resetHistory()
  }

  function resetProject() {
    if (
      !window.confirm(
        'Reset the entire project? The canvas, all frames, and settings will be cleared. This cannot be undone.',
      )
    ) {
      return
    }

    const reset = defaultProject()
    setResolution(reset.resolution)
    setPixels(reset.pixels)
    setBaselinePixels(reset.baselinePixels)
    setFrames(reset.frames)
    setEditingFrameId(reset.editingFrameId)
    setTextDraft(null)
    setTextValue('')
    setTextFontSize(7)
    setTool('pencil')
    setColor(reset.color)
    setColorDraft(reset.color)
    setFps(reset.fps)
    setExportScale(reset.exportScale)
    setZoom(reset.zoom)
    setShowGrid(reset.showGrid)
    setTransparentBackground(reset.transparentBackground)
    setBackgroundColor(reset.backgroundColor)
    setMode('draw')
    setPhotoCanvas(null)
    setPhotoFrames([])
    setSelectedPhotoId(null)
    setIsPlaying(false)
    setPreviewIndex(0)
    setShowExportDialog(false)
    setShowImportAnimation(false)
    resetHistory()
    setToast('Project reset complete')
  }

  function snapshot() {
    if (frames.length >= 100) {
      setToast('The 100-frame limit has been reached')
      return
    }
    const nextPixels = displayPixels.slice()
    const frame: AnimationFrame = { id: newId(), pixels: nextPixels, createdAt: Date.now() }
    setFrames((current) => [...current, frame])
    setPixels(nextPixels)
    setBaselinePixels(nextPixels.slice())
    setTextDraft(null)
    setEditingFrameId(null)
    setPreviewIndex(frames.length)
    if (frames.length + 1 === 80) setToast('80 frames reached. Adding more may affect performance')
    else setToast(`Created Frame ${frames.length + 1}`)
  }

  function updateFrame() {
    if (!editingFrameId) return
    const nextPixels = displayPixels.slice()
    setFrames((current) =>
      current.map((frame) =>
        frame.id === editingFrameId ? { ...frame, pixels: nextPixels } : frame,
      ),
    )
    setPixels(nextPixels)
    setBaselinePixels(nextPixels.slice())
    setTextDraft(null)
    setToast('Frame updated')
  }

  function selectFrame(frame: AnimationFrame) {
    if (dirty && !window.confirm('The canvas has unsaved changes. Switch frames anyway?')) return
    setPixels(frame.pixels.slice())
    setBaselinePixels(frame.pixels.slice())
    setEditingFrameId(frame.id)
    setTextDraft(null)
    setPreviewIndex(Math.max(0, frames.findIndex((item) => item.id === frame.id)))
    resetHistory()
  }

  function deleteFrame(id: string) {
    const index = frames.findIndex((frame) => frame.id === id)
    if (index < 0) return
    setFrames((current) => current.filter((frame) => frame.id !== id))
    if (editingFrameId === id) {
      setEditingFrameId(null)
      setBaselinePixels(createBlankPixels(resolution))
    }
    setToast(`Deleted Frame ${index + 1}`)
  }

  function duplicateFrame(id: string) {
    if (frames.length >= 100) {
      setToast('The 100-frame limit has been reached')
      return
    }
    setFrames((current) => {
      const index = current.findIndex((frame) => frame.id === id)
      if (index < 0) return current
      const duplicate: AnimationFrame = {
        id: newId(),
        pixels: current[index].pixels.slice(),
        createdAt: Date.now(),
      }
      const next = current.slice()
      next.splice(index + 1, 0, duplicate)
      return next
    })
    if (frames.length + 1 === 80) setToast('80 frames reached. Adding more may affect performance')
    else setToast('Frame duplicated')
  }

  function reorderFrames(activeId: string, overId: string) {
    setFrames((current) => {
      const oldIndex = current.findIndex((frame) => frame.id === activeId)
      const newIndex = current.findIndex((frame) => frame.id === overId)
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex)
    })
  }

  function requestExport() {
    if (frames.length > 0 && dirty) {
      setShowExportDialog(true)
      return
    }
    performExport(frames.length === 0)
  }

  function performExport(includeCurrent: boolean) {
    setShowExportDialog(false)
    setIsExporting(true)
    window.setTimeout(() => {
      try {
        const exportFrames = frames.map((frame) => frame.pixels)
        if (includeCurrent || exportFrames.length === 0) exportFrames.push(displayPixels)
        const bytes = encodeGif({
          frames: exportFrames,
          resolution,
          scale: exportScale,
          fps,
          transparentBackground,
          backgroundColor,
        })
        const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
        downloadGif(bytes, `pixel-loop-${stamp}.gif`)
        setToast(`GIF exported with ${exportFrames.length} frame${exportFrames.length === 1 ? '' : 's'}`)
      } catch (error) {
        console.error(error)
        setToast('GIF export failed. Please try again')
      } finally {
        setIsExporting(false)
      }
    }, 50)
  }

  const previewPixels = frames.length > 0 ? frames[previewIndex]?.pixels : displayPixels
  const previewPhoto =
    photoFrames.length > 0
      ? photoFrames[Math.min(previewIndex, photoFrames.length - 1)] ?? null
      : null
  const photoMoveButtons: Array<{
    direction: PixelShiftDirection
    icon: typeof ArrowUp
    label: string
  }> = [
    { direction: 'up', icon: ArrowUp, label: 'Move up' },
    { direction: 'left', icon: ArrowLeft, label: 'Move left' },
    { direction: 'right', icon: ArrowRight, label: 'Move right' },
    { direction: 'down', icon: ArrowDown, label: 'Move down' },
  ]
  const toolOptions: Array<{
    id: DrawingTool
    label: string
    shortcut: string
    icon: typeof Pencil
  }> = [
    { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: Pencil },
    { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
    { id: 'eyedropper', label: 'Eyedropper', shortcut: 'I', icon: Pipette },
    { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  ]

  return (
    <div className="min-h-screen bg-[#f5f4f0] text-[#1a1a2e]">
      <header className="border-b border-black/6 bg-[#f5f4f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-4 px-4 py-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 grid-cols-3 gap-[2px] rounded-xl bg-[#1a1a2e] p-2 shadow-lg shadow-slate-900/10">
              {Array.from({ length: 9 }, (_, index) => (
                <span
                  key={index}
                  className={`rounded-[1px] ${[1, 3, 4, 5, 7].includes(index) ? 'bg-[#4ade80]' : 'bg-white/15'}`}
                />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-[-0.02em] sm:text-lg">Pixel Loop</h1>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#15803d]">
                  Studio
                </span>
              </div>
              <p className="hidden text-xs text-slate-400 sm:block">Draw tiny. Animate boldly.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
              {(
                [
                  { id: 'draw', label: 'Draw', icon: Pencil },
                  { id: 'gif', label: 'GIF Maker', icon: Film },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchMode(id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition sm:px-3 ${
                    mode === id
                      ? 'bg-[#1a1a2e] text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  aria-pressed={mode === id}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-1.5 text-xs text-slate-400 lg:flex">
              {saveStatus === 'saving' || saveStatus === 'loading' ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : saveStatus === 'error' ? (
                <span className="h-2 w-2 rounded-full bg-red-400" />
              ) : (
                <Check size={13} className="text-[#16a34a]" />
              )}
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'loading'
                  ? 'Loading…'
                  : saveStatus === 'error'
                    ? 'Autosave failed'
                    : 'Autosaved'}
            </div>

            {photoMode ? (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  onChange={handlePhotoInput}
                  className="sr-only"
                  aria-label="Choose photos to add as frames"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isImporting || photoFrames.length >= MAX_PHOTO_FRAMES}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-[#16a34a]/30 hover:text-[#15803d] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-50 sm:px-4"
                  title="Add one or more photos as animation frames"
                >
                  {isImporting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                  <span className="hidden sm:inline">
                    {isImporting ? 'Adding…' : 'Upload photos'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={exportPhotos}
                  disabled={isExporting || !hydrated || photoFrames.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-3.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-700/15 transition hover:-translate-y-0.5 hover:bg-[#15803d] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60 sm:px-5"
                >
                  {isExporting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span className="hidden sm:inline">{isExporting ? 'Encoding…' : 'Export GIF'}</span>
                </button>
              </>
            ) : (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageImport}
                  className="sr-only"
                  aria-label="Choose an image to import"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isImporting}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-[#16a34a]/30 hover:text-[#15803d] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-50 sm:px-4"
                  title="Supports PNG, JPG, WebP, and the first frame of GIF files"
                >
                  {isImporting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                  <span className="hidden sm:inline">
                    {isImporting ? 'Parsing…' : 'Upload image'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportAnimation(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-[#16a34a]/30 hover:text-[#15803d] sm:px-4"
                  title="Paste pixel-loop/v1 animation JSON"
                >
                  <Braces size={16} />
                  <span className="hidden lg:inline">Import JSON</span>
                </button>
                <button
                  type="button"
                  onClick={requestExport}
                  disabled={isExporting || !hydrated}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-3.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-700/15 transition hover:-translate-y-0.5 hover:bg-[#15803d] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60 sm:px-5"
                >
                  {isExporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
                  <span className="hidden sm:inline">{isExporting ? 'Encoding…' : 'Export GIF'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1540px] space-y-5 px-4 py-5 sm:px-7 lg:px-10 lg:py-7">
        <div className="grid items-start gap-5 xl:grid-cols-[210px_minmax(520px,1fr)_290px]">
          {!photoMode && (
          <aside className="order-2 rounded-2xl border border-black/6 bg-white p-4 shadow-[0_12px_40px_rgba(26,26,46,0.04)] xl:order-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tools</h2>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                01
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 xl:grid-cols-1">
              {toolOptions.map(({ id, label, shortcut, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTool(id)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-sm font-semibold transition xl:justify-start xl:px-3 ${
                    tool === id
                      ? 'border-[#16a34a]/25 bg-green-50 text-[#15803d] shadow-sm'
                      : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                  <kbd className="ml-auto hidden rounded bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-400 shadow-sm xl:inline">
                    {shortcut}
                  </kbd>
                </button>
              ))}
            </div>

            {tool === 'text' && (
              <div className="mt-4 rounded-xl border border-green-100 bg-green-50/70 p-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#15803d]">
                  Text content
                  <input
                    value={textValue}
                    maxLength={40}
                    placeholder="Type something…"
                    onChange={(event) => {
                      const value = event.target.value
                      setTextValue(value)
                      setTextDraft((current) => (current ? { ...current, text: value } : current))
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !textDraft) placeText()
                    }}
                    className="mt-2 w-full rounded-lg border border-green-200 bg-white px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-slate-700 outline-none"
                    aria-label="Text content"
                  />
                </label>
                <label className="mt-3 block text-[10px] font-bold text-slate-500">
                  <span className="mb-1.5 flex items-center justify-between">
                    Pixel size <strong className="text-[#15803d]">{textFontSize}px</strong>
                  </span>
                  <input
                    type="range"
                    min={4}
                    max={resolution}
                    value={textFontSize}
                    onChange={(event) => {
                      const fontSize = Number(event.target.value)
                      setTextFontSize(fontSize)
                      setTextDraft((current) => (current ? { ...current, fontSize } : current))
                    }}
                    className="range-light w-full"
                    aria-label="Text pixel size"
                  />
                </label>
                {!textDraft ? (
                  <button
                    type="button"
                    onClick={placeText}
                    disabled={!textValue.trim()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#16a34a] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Type size={14} /> Place on canvas
                  </button>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTextDraft(null)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={applyText}
                      disabled={!textValue.trim()}
                      className="rounded-lg bg-[#16a34a] px-2 py-2 text-xs font-bold text-white hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Apply text
                    </button>
                  </div>
                )}
                <p className="mt-2 text-[9px] leading-4 text-[#15803d]/75">
                  Drag the outlined text on the canvas. Arrow keys fine-tune its position.
                </p>
              </div>
            )}

            <div className="my-5 h-px bg-slate-100" />
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Active color
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/10">
                <span className="absolute inset-0" style={{ backgroundColor: color }} />
                <input
                  type="color"
                  value={color}
                  onChange={(event) => {
                    setColor(event.target.value)
                    setColorDraft(event.target.value)
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Choose a color"
                />
              </label>
              <input
                value={colorDraft}
                onChange={(event) => setColorDraft(event.target.value)}
                onBlur={applyColorDraft}
                onKeyDown={(event) => event.key === 'Enter' && applyColorDraft()}
                aria-label="Hex color"
                className="min-w-0 flex-1 bg-transparent font-mono text-xs font-semibold uppercase text-slate-600 outline-none"
              />
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5 xl:grid-cols-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setColor(preset)
                    setColorDraft(preset)
                    setTool('pencil')
                  }}
                  aria-label={`Use color ${preset}`}
                  className={`aspect-square rounded-lg ring-1 ring-black/10 transition hover:scale-110 ${
                    color === preset ? 'outline-2 outline-offset-2 outline-[#16a34a]' : ''
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>

            <div className="my-5 h-px bg-slate-100" />
            <div className="grid grid-cols-3 gap-2 xl:grid-cols-2">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="tool-utility"
                title="Undo (⌘/Ctrl + Z)"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="tool-utility"
                title="Redo (⌘/Ctrl + Shift + Z)"
              >
                <Redo2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  commitPixels(createBlankPixels(resolution))
                  setTextDraft(null)
                }}
                disabled={!hasPaint(pixels) && !textDraft}
                className="tool-utility xl:col-span-2"
                title="Clear canvas"
              >
                <Trash2 size={15} />
                <span className="hidden xl:inline">Clear</span>
              </button>
            </div>
          </aside>
          )}

          {photoMode && (
          <aside className="order-2 rounded-2xl border border-black/6 bg-white p-4 shadow-[0_12px_40px_rgba(26,26,46,0.04)] xl:order-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reposition</h2>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                01
              </span>
            </div>
            {selectedPhoto ? (
              <>
                <div className="mx-auto grid w-max grid-cols-3 gap-1.5">
                  <span />
                  <button type="button" onClick={() => nudgePhoto('up')} className="photo-nudge" aria-label="Move up">
                    <ArrowUp size={16} />
                  </button>
                  <span />
                  <button type="button" onClick={() => nudgePhoto('left')} className="photo-nudge" aria-label="Move left">
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => resetPhotoPosition(selectedPhoto.id)}
                    className="photo-nudge"
                    aria-label="Center photo"
                    title="Recenter"
                  >
                    <Locate size={15} />
                  </button>
                  <button type="button" onClick={() => nudgePhoto('right')} className="photo-nudge" aria-label="Move right">
                    <ArrowRight size={16} />
                  </button>
                  <span />
                  <button type="button" onClick={() => nudgePhoto('down')} className="photo-nudge" aria-label="Move down">
                    <ArrowDown size={16} />
                  </button>
                  <span />
                </div>
                <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">
                  Arrow keys nudge · drag the photo on the canvas to pan
                </p>
              </>
            ) : (
              <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-4 text-slate-400">
                Select a frame, then use the arrows or drag the photo on the canvas to reposition it.
              </p>
            )}

            <div className="my-5 h-px bg-slate-100" />
            <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Canvas</span>
                <span className="font-mono text-slate-600">
                  {photoCanvas ? `${photoCanvas.width}×${photoCanvas.height}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Frames</span>
                <span className="font-mono text-slate-600">
                  {photoFrames.length} / {MAX_PHOTO_FRAMES}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={clearPhotos}
              disabled={photoFrames.length === 0}
              className="tool-utility mt-4 w-full"
              title="Remove all frames"
            >
              <Trash2 size={15} />
              <span>Clear all frames</span>
            </button>
          </aside>
          )}

          {!photoMode && (
          <section className="order-1 min-w-0 overflow-hidden rounded-[28px] border border-black/6 bg-white shadow-[0_20px_60px_rgba(26,26,46,0.06)] xl:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold">Canvas</h2>
                  {dirty && (
                    <span className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {editingFrameId ? 'Editing an existing frame' : 'Free drawing mode'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={resolution}
                  onChange={(event) => changeResolution(Number(event.target.value) as Resolution)}
                  className="control-select"
                  aria-label="Canvas resolution"
                >
                  {RESOLUTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} × {size}
                    </option>
                  ))}
                </select>
                <select
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="control-select"
                  aria-label="Canvas zoom"
                >
                  {ZOOM_OPTIONS[resolution].map((value) => (
                    <option key={value} value={value}>
                      {value * 100}%
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowGrid((current) => !current)}
                  className={`control-icon ${showGrid ? 'bg-green-50 text-[#15803d]' : ''}`}
                  title="Show or hide the grid"
                >
                  <Grid3X3 size={16} />
                </button>
              </div>
            </div>

            <div className="canvas-workspace flex min-h-[540px] max-w-full items-center justify-center overflow-auto p-8 sm:p-12">
              <PixelCanvas
                pixels={displayPixels}
                resolution={resolution}
                zoom={zoom}
                showGrid={showGrid}
                tool={tool}
                onStrokeStart={handleStrokeStart}
                onDraw={handleDraw}
                onStrokeEnd={handleStrokeEnd}
                onPick={pickColor}
                onImageDrop={(file) => void processImageFile(file)}
                isImporting={isImporting}
                textSelection={
                  textDraft && renderedText
                    ? { x: textDraft.x, y: textDraft.y, bounds: renderedText.bounds }
                    : null
                }
                onMoveText={moveText}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-500">Tip:</span> Drag placed text freely, use arrow keys for precise movement, and Space creates a snapshot
              </p>
              <div className="flex gap-2">
                {editingFrameId && (
                  <button
                    type="button"
                    onClick={updateFrame}
                    disabled={!dirty}
                    className="rounded-xl border border-[#16a34a]/25 px-4 py-2 text-xs font-bold text-[#15803d] transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Update Frame
                  </button>
                )}
                <button
                  type="button"
                  onClick={snapshot}
                  disabled={frames.length >= 100}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a2e] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#292944] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Camera size={14} /> Snapshot
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/60">
                    Space
                  </kbd>
                </button>
              </div>
            </div>
          </section>
          )}

          {photoMode && (
          <section className="order-1 min-w-0 overflow-hidden rounded-[28px] border border-black/6 bg-white shadow-[0_20px_60px_rgba(26,26,46,0.06)] xl:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-bold">GIF Canvas</h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {selectedPhoto
                    ? `Editing frame ${photoFrames.findIndex((frame) => frame.id === selectedPhoto.id) + 1} of ${photoFrames.length}`
                    : 'Upload photos to build your GIF'}
                </p>
              </div>
              {photoCanvas && (
                <span className="font-mono text-[10px] text-slate-400">
                  {photoCanvas.width} × {photoCanvas.height}
                </span>
              )}
            </div>

            <div className="canvas-workspace flex min-h-[540px] max-w-full items-center justify-center overflow-auto p-8 sm:p-12">
              <PhotoCanvas
                frame={selectedPhoto}
                canvas={photoCanvas}
                onMove={(dx, dy) => selectedPhoto && movePhoto(selectedPhoto.id, dx, dy)}
                onUpload={(files) => void addPhotoFiles(files)}
                isImporting={isImporting}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-500">Tip:</span> Each photo is one frame. Drag to pan, arrow keys nudge, and the timeline sets the order
              </p>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isImporting || photoFrames.length >= MAX_PHOTO_FRAMES}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1a1a2e] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#292944] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ImagePlus size={14} /> Add photos
              </button>
            </div>
          </section>
          )}

          <aside className="order-3 space-y-5">
            <section className="overflow-hidden rounded-[24px] bg-[#1a1a2e] p-5 text-white shadow-[0_18px_48px_rgba(26,26,46,0.12)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#4ade80]">Live preview</p>
                  <h2 className="mt-1 text-sm font-bold">Animation</h2>
                </div>
                <span className="font-mono text-[10px] text-white/35">
                  {photoMode
                    ? photoFrames.length > 0
                      ? `${previewIndex + 1}/${photoFrames.length}`
                      : 'PHOTO'
                    : frames.length > 0
                      ? `${previewIndex + 1}/${frames.length}`
                      : 'CANVAS'}
                </span>
              </div>
              {photoMode ? (
                photoCanvas && previewPhoto ? (
                  <PhotoFramePreview
                    frame={previewPhoto}
                    canvas={photoCanvas}
                    className="mx-auto aspect-square w-full max-w-56 rounded-xl ring-1 ring-white/10"
                  />
                ) : (
                  <div className="canvas-checker mx-auto flex aspect-square w-full max-w-56 items-center justify-center rounded-xl text-[11px] font-semibold text-slate-400 ring-1 ring-white/10">
                    No frames yet
                  </div>
                )
              ) : (
                <PixelPreview
                  pixels={previewPixels ?? displayPixels}
                  resolution={resolution}
                  className="mx-auto aspect-square w-full max-w-56 rounded-xl ring-1 ring-white/10"
                />
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying((current) => !current)}
                  disabled={timelineLength < 2}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                >
                  {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, timelineLength - 1)}
                  value={Math.min(previewIndex, Math.max(0, timelineLength - 1))}
                  onChange={(event) => {
                    setIsPlaying(false)
                    setPreviewIndex(Number(event.target.value))
                  }}
                  disabled={timelineLength === 0}
                  className="range-dark min-w-0 flex-1"
                  aria-label="Preview frame"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-black/6 bg-white p-5 shadow-[0_12px_40px_rgba(26,26,46,0.04)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Export settings</h2>
                <WandSparkles size={15} className="text-[#16a34a]" />
              </div>

              <label className="setting-row">
                <span>
                  <strong>Playback</strong>
                  <small>{fps} FPS</small>
                </span>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={fps}
                  onChange={(event) => setFps(Number(event.target.value))}
                  className="range-light w-28"
                />
              </label>

              <label className="setting-row">
                <span>
                  <strong>Output scale</strong>
                  <small>
                    {photoMode
                      ? photoCanvas
                        ? `${photoCanvas.width * photoExportScale} × ${photoCanvas.height * photoExportScale} px`
                        : 'Upload a photo first'
                      : `${resolution * exportScale} px`}
                  </small>
                </span>
                <select
                  value={exportScale}
                  onChange={(event) => setExportScale(Number(event.target.value))}
                  className="control-select"
                >
                  {[1, 2, 4, 8].map((scale) => (
                    <option key={scale} value={scale}>
                      {scale}×
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-700">Transparent background</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">The checkerboard is not exported</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={transparentBackground}
                    onClick={() => setTransparentBackground((current) => !current)}
                    className={`relative h-6 w-11 rounded-full transition ${
                      transparentBackground ? 'bg-[#16a34a]' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        transparentBackground ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                {!transparentBackground && (
                  <label className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs font-semibold text-slate-500">
                    Background color
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(event) => setBackgroundColor(event.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
                    />
                  </label>
                )}
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl bg-green-50 p-3 text-[10px] leading-4 text-[#15803d]">
                <Sparkles size={13} className="mt-0.5 shrink-0" />
                {photoMode
                  ? 'Photos are quantized to 256 colors per frame and capped for size. GIFs loop forever.'
                  : 'Integer nearest-neighbor scaling keeps pixel edges crisp. GIFs loop forever.'}
              </div>

              <button
                type="button"
                onClick={resetProject}
                disabled={isImporting || isExporting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-red-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FolderX size={14} />
                Reset entire project
              </button>
            </section>
          </aside>
        </div>

        {!photoMode && frames.length >= 80 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            <RotateCcw size={14} /> {frames.length} frames created. You are approaching the 100-frame limit, so preview and export may take longer.
          </div>
        )}

        {photoMode ? (
          <Timeline
            frames={photoFrames}
            editingFrameId={selectedPhotoId}
            renderPreview={(frame) =>
              photoCanvas ? (
                <PhotoFramePreview
                  frame={frame}
                  canvas={photoCanvas}
                  className="aspect-square w-full rounded-lg ring-1 ring-white/10"
                />
              ) : null
            }
            onSelect={selectPhoto}
            onDelete={deletePhotoFrame}
            onDuplicate={duplicatePhotoFrame}
            onReorder={reorderPhotoFrames}
            onAdd={() => photoInputRef.current?.click()}
            addLabel="Upload photos"
            addDisabled={isImporting || photoFrames.length >= MAX_PHOTO_FRAMES}
            limit={MAX_PHOTO_FRAMES}
            emptyTitle="Upload your first photo"
            emptyHint="Each photo you add becomes a frame in the GIF"
          />
        ) : (
          <Timeline
            frames={frames}
            editingFrameId={editingFrameId}
            renderPreview={(frame, index) => (
              <PixelPreview
                pixels={frame.pixels}
                resolution={resolution}
                label={`Frame ${index + 1} preview`}
                className="aspect-square w-full rounded-lg ring-1 ring-white/10"
              />
            )}
            onSelect={selectFrame}
            onDelete={deleteFrame}
            onDuplicate={duplicateFrame}
            onReorder={reorderFrames}
            onAdd={snapshot}
            addLabel="Snapshot frame"
            addDisabled={frames.length >= 100}
            emptyTitle="Create your first snapshot"
            emptyHint="The canvas stays in place so you can draw the next frame"
          />
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
          <span>Local-first · No upload</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> Pixel Loop Studio
          </span>
        </footer>
      </main>

      {showExportDialog && (
        <ExportDialog
          onInclude={() => performExport(true)}
          onSavedOnly={() => performExport(false)}
          onCancel={() => setShowExportDialog(false)}
        />
      )}

      {showImportAnimation && (
        <ImportAnimationDialog
          onClose={() => setShowImportAnimation(false)}
          onImport={importAnimation}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1a1a2e] px-4 py-2.5 text-xs font-semibold text-white shadow-xl">
          <Check size={14} className="text-[#4ade80]" />
          {toast}
        </div>
      )}
    </div>
  )
}
