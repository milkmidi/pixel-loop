// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PixelCanvas } from './PixelCanvas'
import type { Pixel } from '../types'

const pixels = Array<Pixel>(16 * 16).fill('#16a34a')

describe('PixelCanvas', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D)
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
  })

  it('temporarily erases while the right mouse button is held', () => {
    const onDraw = vi.fn()
    const onStrokeStart = vi.fn()
    const onStrokeEnd = vi.fn()

    render(
      <PixelCanvas
        pixels={pixels}
        resolution={16}
        zoom={10}
        showGrid
        tool="pencil"
        onStrokeStart={onStrokeStart}
        onDraw={onDraw}
        onStrokeEnd={onStrokeEnd}
        onPick={vi.fn()}
        onImageDrop={vi.fn()}
        isImporting={false}
      />,
    )

    const canvas = screen.getByLabelText('16 by 16 pixel drawing canvas')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 160,
      bottom: 160,
      width: 160,
      height: 160,
      toJSON: () => ({}),
    })

    fireEvent.pointerDown(canvas, {
      button: 2,
      buttons: 2,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 25,
      clientY: 35,
    })

    expect(onStrokeStart).toHaveBeenCalledOnce()
    expect(onDraw).toHaveBeenCalledWith([50], true)

    fireEvent.pointerMove(canvas, {
      buttons: 2,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 45,
      clientY: 35,
    })
    expect(onDraw).toHaveBeenLastCalledWith([50, 51, 52], true)

    fireEvent.pointerUp(canvas, {
      button: 2,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 45,
      clientY: 35,
    })
    expect(onStrokeEnd).toHaveBeenCalledOnce()
  })

  it('prevents the native context menu on the canvas', () => {
    render(
      <PixelCanvas
        pixels={pixels}
        resolution={16}
        zoom={10}
        showGrid
        tool="pencil"
        onStrokeStart={vi.fn()}
        onDraw={vi.fn()}
        onStrokeEnd={vi.fn()}
        onPick={vi.fn()}
        onImageDrop={vi.fn()}
        isImporting={false}
      />,
    )

    const canvas = screen.getByLabelText('16 by 16 pixel drawing canvas')
    expect(fireEvent.contextMenu(canvas)).toBe(false)
  })
})
