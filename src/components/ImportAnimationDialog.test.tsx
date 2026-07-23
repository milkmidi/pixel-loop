// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImportAnimationDialog } from './ImportAnimationDialog'

const validAnimation = JSON.stringify({
  format: 'pixel-loop/v1',
  size: 16,
  fps: 6,
  background: 'transparent',
  palette: { G: '#16a34a' },
  frames: [
    {
      rows: Array(16).fill('................'),
    },
  ],
})

describe('ImportAnimationDialog', () => {
  afterEach(cleanup)

  it('shows a precise validation error for invalid JSON', () => {
    render(<ImportAnimationDialog onClose={vi.fn()} onImport={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Animation JSON'), {
      target: { value: '{ invalid' },
    })

    expect(screen.getByRole('alert').textContent).toContain('Invalid JSON')
    expect(
      (screen.getByRole('button', { name: 'Import animation' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('shows a summary and returns parsed animation data', () => {
    const onImport = vi.fn()
    render(<ImportAnimationDialog onClose={vi.fn()} onImport={onImport} />)

    fireEvent.change(screen.getByLabelText('Animation JSON'), {
      target: { value: validAnimation },
    })

    expect(screen.getByText('16×16')).toBeTruthy()
    expect(screen.getByText('1 frame')).toBeTruthy()
    expect(screen.getByText('6 FPS')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Import animation' }))
    expect(onImport).toHaveBeenCalledOnce()
    expect(onImport.mock.calls[0][0].frames[0]).toHaveLength(256)
  })

  it('copies the complete agent instructions to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<ImportAnimationDialog onClose={vi.fn()} onImport={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy agent instructions' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(writeText.mock.calls[0][0]).toContain('# Pixel Loop Agent Instructions')
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeTruthy()
  })
})
