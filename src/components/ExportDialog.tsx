import { Layers3, X } from 'lucide-react'

interface ExportDialogProps {
  onInclude: () => void
  onSavedOnly: () => void
  onCancel: () => void
}

export function ExportDialog({ onInclude, onSavedOnly, onCancel }: ExportDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10101d]/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-[#16a34a]">
            <Layers3 size={21} />
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="export-dialog-title" className="text-xl font-bold tracking-tight text-[#1a1a2e]">
          The canvas has unsaved changes
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Add the current canvas as the final GIF frame? This will not change your timeline.
        </p>
        <div className="mt-6 grid gap-2">
          <button
            type="button"
            onClick={onInclude}
            className="rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-bold text-white hover:bg-[#15803d]"
          >
            Add current canvas and export
          </button>
          <button
            type="button"
            onClick={onSavedOnly}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export saved frames only
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
