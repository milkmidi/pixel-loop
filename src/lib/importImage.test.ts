import { describe, expect, it } from 'vitest'
import { calculateContainedRect, rgbaToPixels } from './importImage'

describe('image import', () => {
  it('fits and centers a landscape image without changing its aspect ratio', () => {
    expect(calculateContainedRect(200, 100, 32)).toEqual({
      x: 0,
      y: 8,
      width: 32,
      height: 16,
    })
  })

  it('fits and centers a portrait image', () => {
    expect(calculateContainedRect(50, 100, 64)).toEqual({
      x: 16,
      y: 0,
      width: 32,
      height: 64,
    })
  })

  it('converts opaque RGBA values to hex and low alpha values to transparent pixels', () => {
    expect(
      rgbaToPixels(new Uint8ClampedArray([22, 163, 74, 255, 255, 255, 255, 127])),
    ).toEqual(['#16a34a', null])
  })
})
