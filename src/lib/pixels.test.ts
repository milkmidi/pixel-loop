import { describe, expect, it } from 'vitest'
import {
  createBlankPixels,
  drawLineIndices,
  normalizeHex,
  pixelsEqual,
  pixelsToRgba,
  shiftPixels,
} from './pixels'

describe('pixel utilities', () => {
  it('creates a blank square pixel buffer', () => {
    expect(createBlankPixels(4)).toEqual(Array(16).fill(null))
  })

  it('normalizes six and three digit hex colors', () => {
    expect(normalizeHex('16A34A')).toBe('#16a34a')
    expect(normalizeHex('#abc')).toBe('#aabbcc')
    expect(normalizeHex('oops')).toBeNull()
  })

  it('compares complete pixel buffers', () => {
    expect(pixelsEqual(['#ffffff', null], ['#ffffff', null])).toBe(true)
    expect(pixelsEqual(['#ffffff'], ['#000000'])).toBe(false)
  })

  it('fills gaps between pointer samples with a pixel-perfect line', () => {
    expect(drawLineIndices({ x: 0, y: 0 }, { x: 3, y: 3 }, 4)).toEqual([
      0, 5, 10, 15,
    ])
  })

  it('upscales pixels without interpolation and preserves transparency', () => {
    const rgba = pixelsToRgba(['#ff0000', null, null, null], 2, 2, true, '#ffffff')
    expect(Array.from(rgba.slice(0, 4))).toEqual([255, 0, 0, 255])
    expect(Array.from(rgba.slice(8, 12))).toEqual([255, 255, 255, 0])
  })

  it.each([
    ['up', 1],
    ['down', 7],
    ['left', 3],
    ['right', 5],
  ] as const)('shifts the complete canvas one pixel %s', (direction, expectedIndex) => {
    const pixels = createBlankPixels(3)
    pixels[4] = '#16a34a'

    const shifted = shiftPixels(pixels, 3, direction)

    expect(shifted[expectedIndex]).toBe('#16a34a')
    expect(shifted.filter(Boolean)).toHaveLength(1)
    expect(pixels[4]).toBe('#16a34a')
  })

  it('clips pixels that move beyond the canvas boundary', () => {
    const pixels = createBlankPixels(3)
    pixels[0] = '#ef4444'
    pixels[4] = '#16a34a'

    const shifted = shiftPixels(pixels, 3, 'up')

    expect(shifted.filter(Boolean)).toEqual(['#16a34a'])
  })
})
