import { describe, expect, it } from 'vitest'
import { encodeGif } from './exportGif'
import { createBlankPixels } from './pixels'

describe('GIF export', () => {
  it('encodes transparent and colored frames as a valid GIF89a stream', () => {
    const first = createBlankPixels(2)
    const second = createBlankPixels(2)
    first[0] = '#16a34a'
    second[3] = '#f59e0b'

    const bytes = encodeGif({
      frames: [first, second],
      resolution: 2,
      scale: 2,
      fps: 8,
      transparentBackground: true,
      backgroundColor: '#ffffff',
    })

    expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a')
    expect(bytes.at(-1)).toBe(0x3b)
    expect(bytes.length).toBeGreaterThan(40)
  })

  it('encodes a fully transparent single frame', () => {
    const bytes = encodeGif({
      frames: [createBlankPixels(2)],
      resolution: 2,
      scale: 1,
      fps: 1,
      transparentBackground: true,
      backgroundColor: '#ffffff',
    })

    expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a')
  })
})
