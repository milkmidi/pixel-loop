// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Pixel } from '../types'
import { usePixelHistory } from './usePixelHistory'

const blank = (): Pixel[] => [null, null, null, null]

describe('usePixelHistory', () => {
  it('groups every update between beginStroke and endStroke into one undo entry', () => {
    const { result } = renderHook(() => usePixelHistory(blank()))

    act(() => {
      result.current.beginStroke()
      result.current.setPixels((current) => {
        const next = current.slice()
        next[0] = '#16a34a'
        return next
      })
      result.current.setPixels((current) => {
        const next = current.slice()
        next[1] = '#16a34a'
        return next
      })
      result.current.endStroke()
    })

    expect(result.current.pixels).toEqual(['#16a34a', '#16a34a', null, null])
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())

    expect(result.current.pixels).toEqual(blank())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('restores undone pixels with redo', () => {
    const { result } = renderHook(() => usePixelHistory(blank()))

    act(() => result.current.commitPixels(['#ef4444', null, null, null]))
    act(() => result.current.undo())
    act(() => result.current.redo())

    expect(result.current.pixels).toEqual(['#ef4444', null, null, null])
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('does not create history for an unchanged stroke or identical commit', () => {
    const { result } = renderHook(() => usePixelHistory(blank()))

    act(() => {
      result.current.beginStroke()
      result.current.endStroke()
      result.current.commitPixels(blank())
    })

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('clears undo and redo stacks without changing current pixels', () => {
    const { result } = renderHook(() => usePixelHistory(blank()))

    act(() => result.current.commitPixels([null, '#3b82f6', null, null]))
    act(() => result.current.undo())
    act(() => result.current.resetHistory())

    expect(result.current.pixels).toEqual(blank())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('keeps only the configured number of undo entries', () => {
    const { result } = renderHook(() => usePixelHistory(blank(), { maxEntries: 2 }))

    act(() => result.current.commitPixels(['#111111', null, null, null]))
    act(() => result.current.commitPixels(['#222222', null, null, null]))
    act(() => result.current.commitPixels(['#333333', null, null, null]))
    act(() => result.current.undo())
    act(() => result.current.undo())
    act(() => result.current.undo())

    expect(result.current.pixels).toEqual(['#111111', null, null, null])
    expect(result.current.canUndo).toBe(false)
  })
})
