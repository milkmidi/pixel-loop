import { useEffect, useMemo, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import {
  Camera,
  Check,
  Download,
  Eraser,
  FolderX,
  Grid3X3,
  LoaderCircle,
  ImagePlus,
  Pause,
  Pencil,
  Pipette,
  Play,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  WandSparkles,
} from 'lucide-react'
import { ExportDialog } from './components/ExportDialog'
import { PixelCanvas } from './components/PixelCanvas'
import { PixelPreview } from './components/PixelPreview'
import { Timeline } from './components/Timeline'
import { downloadGif, encodeGif } from './lib/exportGif'
import { importImageFile } from './lib/importImage'
import { createBlankPixels, hasPaint, normalizeHex, pixelsEqual } from './lib/pixels'
import { loadProject, saveProject } from './lib/storage'
import {
  RESOLUTIONS,
  type AnimationFrame,
  type DrawingTool,
  type Pixel,
  type ProjectState,
  type Resolution,
} from './types'

const DEFAULT_COLOR = '#16a34a'
const COLOR_PRESETS = ['#1a1a2e', '#16a34a', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7']
const ZOOM_OPTIONS: Record<Resolution, number[]> = {
  16: [12, 16, 20, 24, 28],
  32: [6, 8, 10, 12, 14],
  64: [4, 6, 8, 10],
}

const defaultProject = (): ProjectState => ({
  version: 1,
  resolution: 32,
  pixels: createBlankPixels(32),
  baselinePixels: createBlankPixels(32),
  frames: [],
  editingFrameId: null,
  color: DEFAULT_COLOR,
  fps: 8,
  exportScale: 4,
  zoom: 12,
  showGrid: true,
  transparentBackground: true,
  backgroundColor: '#ffffff',
})

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
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
  const [pixels, setPixels] = useState<Pixel[]>(initial.pixels)
  const [baselinePixels, setBaselinePixels] = useState<Pixel[]>(initial.baselinePixels)
  const [frames, setFrames] = useState<AnimationFrame[]>(initial.frames)
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null)
  const [tool, setTool] = useState<DrawingTool>('pencil')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [colorDraft, setColorDraft] = useState(DEFAULT_COLOR)
  const [fps, setFps] = useState(8)
  const [exportScale, setExportScale] = useState(4)
  const [zoom, setZoom] = useState(12)
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
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [, setHistoryRevision] = useState(0)

  const undoStackRef = useRef<Pixel[][]>([])
  const redoStackRef = useRef<Pixel[][]>([])
  const strokeStartRef = useRef<Pixel[] | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const dirty = useMemo(() => !pixelsEqual(pixels, baselinePixels), [pixels, baselinePixels])

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
        setZoom(project.zoom ?? (project.resolution === 16 ? 24 : project.resolution === 32 ? 12 : 6))
        setShowGrid(project.showGrid ?? true)
        setTransparentBackground(project.transparentBackground ?? true)
        setBackgroundColor(project.backgroundColor ?? '#ffffff')
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
  ])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!isPlaying || frames.length < 2) return
    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % frames.length)
    }, 1000 / fps)
    return () => window.clearInterval(timer)
  }, [isPlaying, frames.length, fps])

  useEffect(() => {
    if (previewIndex >= frames.length) setPreviewIndex(Math.max(0, frames.length - 1))
    if (frames.length < 2) setIsPlaying(false)
  }, [frames.length, previewIndex])

  function resetHistory() {
    undoStackRef.current = []
    redoStackRef.current = []
    setHistoryRevision((current) => current + 1)
  }

  function handleStrokeStart() {
    strokeStartRef.current = pixels.slice()
  }

  function handleDraw(indices: number[]) {
    const nextColor = tool === 'eraser' ? null : color
    setPixels((current) => {
      const next = current.slice()
      indices.forEach((index) => {
        next[index] = nextColor
      })
      return next
    })
  }

  function handleStrokeEnd() {
    setPixels((current) => {
      const start = strokeStartRef.current
      if (start && !pixelsEqual(start, current)) {
        undoStackRef.current.push(start)
        if (undoStackRef.current.length > 80) undoStackRef.current.shift()
        redoStackRef.current = []
        setHistoryRevision((revision) => revision + 1)
      }
      strokeStartRef.current = null
      return current
    })
  }

  function commitPixels(next: Pixel[]) {
    if (pixelsEqual(pixels, next)) return
    undoStackRef.current.push(pixels.slice())
    if (undoStackRef.current.length > 80) undoStackRef.current.shift()
    redoStackRef.current = []
    setPixels(next)
    setHistoryRevision((current) => current + 1)
  }

  function undo() {
    const previous = undoStackRef.current.pop()
    if (!previous) return
    redoStackRef.current.push(pixels.slice())
    setPixels(previous)
    setHistoryRevision((current) => current + 1)
  }

  function redo() {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(pixels.slice())
    setPixels(next)
    setHistoryRevision((current) => current + 1)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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
      if (!command && event.key.toLowerCase() === 'p') setTool('pencil')
      if (!command && event.key.toLowerCase() === 'e') setTool('eraser')
      if (!command && event.key.toLowerCase() === 'i') setTool('eyedropper')
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
    setPreviewIndex(0)
    setZoom(nextResolution === 16 ? 24 : nextResolution === 32 ? 12 : 6)
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
    setTool('pencil')
    setColor(reset.color)
    setColorDraft(reset.color)
    setFps(reset.fps)
    setExportScale(reset.exportScale)
    setZoom(reset.zoom)
    setShowGrid(reset.showGrid)
    setTransparentBackground(reset.transparentBackground)
    setBackgroundColor(reset.backgroundColor)
    setIsPlaying(false)
    setPreviewIndex(0)
    setShowExportDialog(false)
    resetHistory()
    setToast('Project reset complete')
  }

  function snapshot() {
    if (frames.length >= 100) {
      setToast('The 100-frame limit has been reached')
      return
    }
    const frame: AnimationFrame = { id: newId(), pixels: pixels.slice(), createdAt: Date.now() }
    setFrames((current) => [...current, frame])
    setBaselinePixels(pixels.slice())
    setEditingFrameId(null)
    setPreviewIndex(frames.length)
    if (frames.length + 1 === 80) setToast('80 frames reached. Adding more may affect performance')
    else setToast(`Created Frame ${frames.length + 1}`)
  }

  function updateFrame() {
    if (!editingFrameId) return
    setFrames((current) =>
      current.map((frame) =>
        frame.id === editingFrameId ? { ...frame, pixels: pixels.slice() } : frame,
      ),
    )
    setBaselinePixels(pixels.slice())
    setToast('Frame updated')
  }

  function selectFrame(frame: AnimationFrame) {
    if (dirty && !window.confirm('The canvas has unsaved changes. Switch frames anyway?')) return
    setPixels(frame.pixels.slice())
    setBaselinePixels(frame.pixels.slice())
    setEditingFrameId(frame.id)
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
        if (includeCurrent || exportFrames.length === 0) exportFrames.push(pixels)
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

  const previewPixels = frames.length > 0 ? frames[previewIndex]?.pixels : pixels
  const toolOptions: Array<{
    id: DrawingTool
    label: string
    shortcut: string
    icon: typeof Pencil
  }> = [
    { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: Pencil },
    { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
    { id: 'eyedropper', label: 'Eyedropper', shortcut: 'I', icon: Pipette },
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
            <div className="hidden items-center gap-1.5 text-xs text-slate-400 md:flex">
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
              onClick={requestExport}
              disabled={isExporting || !hydrated}
              className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-3.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-700/15 transition hover:-translate-y-0.5 hover:bg-[#15803d] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60 sm:px-5"
            >
              {isExporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
              <span className="hidden sm:inline">{isExporting ? 'Encoding…' : 'Export GIF'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1540px] space-y-5 px-4 py-5 sm:px-7 lg:px-10 lg:py-7">
        <div className="grid items-start gap-5 xl:grid-cols-[210px_minmax(520px,1fr)_290px]">
          <aside className="order-2 rounded-2xl border border-black/6 bg-white p-4 shadow-[0_12px_40px_rgba(26,26,46,0.04)] xl:order-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tools</h2>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                01
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
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
                disabled={undoStackRef.current.length === 0}
                className="tool-utility"
                title="Undo (⌘/Ctrl + Z)"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={redoStackRef.current.length === 0}
                className="tool-utility"
                title="Redo (⌘/Ctrl + Shift + Z)"
              >
                <Redo2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => commitPixels(createBlankPixels(resolution))}
                disabled={!hasPaint(pixels)}
                className="tool-utility xl:col-span-2"
                title="Clear canvas"
              >
                <Trash2 size={15} />
                <span className="hidden xl:inline">Clear</span>
              </button>
            </div>
          </aside>

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
                pixels={pixels}
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
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-[11px] text-slate-400">
                <span className="font-semibold text-slate-500">Tip:</span> Drop images onto the canvas, use P / E / I to switch tools, and press Space to snapshot
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

          <aside className="order-3 space-y-5">
            <section className="overflow-hidden rounded-[24px] bg-[#1a1a2e] p-5 text-white shadow-[0_18px_48px_rgba(26,26,46,0.12)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#4ade80]">Live preview</p>
                  <h2 className="mt-1 text-sm font-bold">Animation</h2>
                </div>
                <span className="font-mono text-[10px] text-white/35">
                  {frames.length > 0 ? `${previewIndex + 1}/${frames.length}` : 'CANVAS'}
                </span>
              </div>
              <PixelPreview
                pixels={previewPixels ?? pixels}
                resolution={resolution}
                className="mx-auto aspect-square w-full max-w-56 rounded-xl ring-1 ring-white/10"
              />
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying((current) => !current)}
                  disabled={frames.length < 2}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                >
                  {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, frames.length - 1)}
                  value={Math.min(previewIndex, Math.max(0, frames.length - 1))}
                  onChange={(event) => {
                    setIsPlaying(false)
                    setPreviewIndex(Number(event.target.value))
                  }}
                  disabled={frames.length === 0}
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
                  <small>{resolution * exportScale} px</small>
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
                Integer nearest-neighbor scaling keeps pixel edges crisp. GIFs loop forever.
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

        {frames.length >= 80 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            <RotateCcw size={14} /> {frames.length} frames created. You are approaching the 100-frame limit, so preview and export may take longer.
          </div>
        )}

        <Timeline
          frames={frames}
          resolution={resolution}
          editingFrameId={editingFrameId}
          onSelect={selectFrame}
          onDelete={deleteFrame}
          onDuplicate={duplicateFrame}
          onReorder={reorderFrames}
          onSnapshot={snapshot}
        />

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

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1a1a2e] px-4 py-2.5 text-xs font-semibold text-white shadow-xl">
          <Check size={14} className="text-[#4ade80]" />
          {toast}
        </div>
      )}
    </div>
  )
}
