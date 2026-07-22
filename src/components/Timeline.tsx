import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { AnimationFrame } from '../types'
import { PixelPreview } from './PixelPreview'

interface TimelineProps {
  frames: AnimationFrame[]
  resolution: number
  editingFrameId: string | null
  onSelect: (frame: AnimationFrame) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onReorder: (activeId: string, overId: string) => void
  onSnapshot: () => void
}

interface SortableFrameProps {
  frame: AnimationFrame
  index: number
  resolution: number
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function SortableFrame({
  frame,
  index,
  resolution,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
}: SortableFrameProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: frame.id,
  })

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative w-28 shrink-0 rounded-xl border p-2 transition ${
        selected
          ? 'border-[#4ade80] bg-white/14 ring-2 ring-[#4ade80]/30'
          : 'border-white/10 bg-white/6 hover:border-white/25 hover:bg-white/10'
      } ${isDragging ? 'z-20 opacity-60' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="cursor-grab rounded p-0.5 text-white/35 hover:text-white active:cursor-grabbing"
          aria-label={`拖曳第 ${index + 1} 幀`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <span className="font-mono text-[10px] font-semibold tracking-wider text-white/45">
          FRAME {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <button type="button" className="block w-full" onClick={onSelect}>
        <PixelPreview
          pixels={frame.pixels}
          resolution={resolution}
          label={`第 ${index + 1} 幀預覽`}
          className="aspect-square w-full rounded-lg ring-1 ring-white/10"
        />
      </button>
      <div className="mt-2 flex justify-end gap-1 opacity-60 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={onDuplicate}
          className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label={`複製第 ${index + 1} 幀`}
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1 text-white/60 hover:bg-red-400/15 hover:text-red-300"
          aria-label={`刪除第 ${index + 1} 幀`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  )
}

export function Timeline({
  frames,
  resolution,
  editingFrameId,
  onSelect,
  onDelete,
  onDuplicate,
  onReorder,
  onSnapshot,
}: TimelineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return
    onReorder(String(event.active.id), String(event.over.id))
  }

  return (
    <section className="rounded-[28px] bg-[#1a1a2e] p-5 text-white shadow-[0_18px_55px_rgba(26,26,46,0.16)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#4ade80]">
            Animation timeline
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">Frames</h2>
            <span className="text-xs text-white/40">{frames.length} / 100</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onSnapshot}
          disabled={frames.length >= 100}
          className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-950/20 transition hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} strokeWidth={2.5} />
          Snapshot frame
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={frames.map((frame) => frame.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex min-h-40 gap-3 overflow-x-auto pb-2">
            {frames.map((frame, index) => (
              <SortableFrame
                key={frame.id}
                frame={frame}
                index={index}
                resolution={resolution}
                selected={editingFrameId === frame.id}
                onSelect={() => onSelect(frame)}
                onDelete={() => onDelete(frame.id)}
                onDuplicate={() => onDuplicate(frame.id)}
              />
            ))}
            {frames.length === 0 && (
              <button
                type="button"
                onClick={onSnapshot}
                className="flex w-full min-w-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 px-8 py-7 text-center text-white/45 transition hover:border-[#4ade80]/50 hover:bg-white/5 hover:text-white/70"
              >
                <Plus className="mb-2" size={22} />
                <span className="text-sm font-semibold">建立第一個 Snapshot</span>
                <span className="mt-1 text-xs text-white/30">擷取後會保留畫布，接著修改下一幀</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
