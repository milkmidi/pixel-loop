import { describe, expect, it } from 'vitest'
import { parseAnimationJson } from './importAnimationJson'

const rows = (filledRow = '................') => [
  filledRow,
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

function animation(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: 'pixel-loop/v1',
    size: 16,
    fps: 6,
    background: 'transparent',
    palette: { G: '#16A34A' },
    frames: [{ rows: rows('G...............') }],
    ...overrides,
  })
}

describe('parseAnimationJson', () => {
  it('parses palette symbols and transparent pixels into editable frames', () => {
    const result = parseAnimationJson(animation())

    expect(result.resolution).toBe(16)
    expect(result.fps).toBe(6)
    expect(result.transparentBackground).toBe(true)
    expect(result.palette).toEqual({ G: '#16a34a' })
    expect(result.frames).toHaveLength(1)
    expect(result.frames[0]).toHaveLength(256)
    expect(result.frames[0][0]).toBe('#16a34a')
    expect(result.frames[0][1]).toBeNull()
  })

  it('accepts an opaque hex background', () => {
    const result = parseAnimationJson(animation({ background: '#F5F4F0' }))
    expect(result.transparentBackground).toBe(false)
    expect(result.backgroundColor).toBe('#f5f4f0')
  })

  it('rejects invalid JSON and unsupported versions', () => {
    expect(() => parseAnimationJson('{ nope')).toThrow('Invalid JSON')
    expect(() => parseAnimationJson(animation({ format: 'pixel-loop/v2' }))).toThrow(
      'Expected "pixel-loop/v1"',
    )
  })

  it('validates size, FPS, and frame count', () => {
    expect(() => parseAnimationJson(animation({ size: 24 }))).toThrow(
      'Size must be 16, 32, or 64',
    )
    expect(() => parseAnimationJson(animation({ fps: 25 }))).toThrow(
      'FPS must be an integer from 1 to 24',
    )
    expect(() => parseAnimationJson(animation({ frames: [] }))).toThrow(
      'Frames must contain between 1 and 100 items',
    )
  })

  it('reports the exact frame and row for invalid dimensions', () => {
    expect(() =>
      parseAnimationJson(animation({ frames: [{ rows: rows().slice(1) }] })),
    ).toThrow('Frame 1 has 15 rows; expected 16')

    expect(() =>
      parseAnimationJson(
        animation({ frames: [{ rows: ['...............', ...rows().slice(1)] }] }),
      ),
    ).toThrow('Frame 1, row 1 has 15 pixels; expected 16')
  })

  it('reports undefined symbols with frame, row, and column', () => {
    expect(() =>
      parseAnimationJson(animation({ frames: [{ rows: rows('...X............') }] })),
    ).toThrow('Frame 1, row 1, column 4 uses undefined palette symbol "X"')
  })

  it('rejects unsafe palette symbols and invalid colors', () => {
    expect(() => parseAnimationJson(animation({ palette: { '.': '#ffffff' } }))).toThrow(
      'Invalid palette symbol "."',
    )
    expect(() => parseAnimationJson(animation({ palette: { G: '#fff' } }))).toThrow(
      'Palette color "G" must use #RRGGBB',
    )
  })
})
