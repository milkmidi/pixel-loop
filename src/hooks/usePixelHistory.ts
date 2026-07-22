import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Pixel } from '../types'
import { pixelsEqual } from '../lib/pixels'

interface UsePixelHistoryOptions {
  maxEntries?: number
}

export function usePixelHistory(
  initialPixels: Pixel[],
  { maxEntries = 80 }: UsePixelHistoryOptions = {},
) {
  const [pixels, setPixelsState] = useState<Pixel[]>(initialPixels)
  const [, setRevision] = useState(0)
  const pixelsRef = useRef(pixels)
  const undoStackRef = useRef<Pixel[][]>([])
  const redoStackRef = useRef<Pixel[][]>([])
  const strokeStartRef = useRef<Pixel[] | null>(null)

  const refresh = useCallback(() => {
    setRevision((current) => current + 1)
  }, [])

  const setPixels = useCallback<Dispatch<SetStateAction<Pixel[]>>>((action) => {
    const next =
      typeof action === 'function'
        ? (action as (current: Pixel[]) => Pixel[])(pixelsRef.current)
        : action
    pixelsRef.current = next
    setPixelsState(next)
  }, [])

  const addUndoEntry = useCallback(
    (entry: Pixel[]) => {
      undoStackRef.current.push(entry.slice())
      if (undoStackRef.current.length > maxEntries) undoStackRef.current.shift()
      redoStackRef.current = []
      refresh()
    },
    [maxEntries, refresh],
  )

  const beginStroke = useCallback(() => {
    strokeStartRef.current = pixelsRef.current.slice()
  }, [])

  const endStroke = useCallback(() => {
    const start = strokeStartRef.current
    strokeStartRef.current = null
    if (!start || pixelsEqual(start, pixelsRef.current)) return
    addUndoEntry(start)
  }, [addUndoEntry])

  const commitPixels = useCallback(
    (next: Pixel[]) => {
      if (pixelsEqual(pixelsRef.current, next)) return
      addUndoEntry(pixelsRef.current)
      setPixels(next)
    },
    [addUndoEntry, setPixels],
  )

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop()
    if (!previous) return
    redoStackRef.current.push(pixelsRef.current.slice())
    setPixels(previous)
    refresh()
  }, [refresh, setPixels])

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(pixelsRef.current.slice())
    setPixels(next)
    refresh()
  }, [refresh, setPixels])

  const resetHistory = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    strokeStartRef.current = null
    refresh()
  }, [refresh])

  return {
    pixels,
    setPixels,
    beginStroke,
    endStroke,
    commitPixels,
    undo,
    redo,
    resetHistory,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
  }
}
