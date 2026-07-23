import { describe, expect, it } from 'vitest'
import { applyTextAlphaMask } from './pixelText'

describe('pixel text utilities', () => {
  it('paints only mask pixels that pass the alpha threshold', () => {
    const result = applyTextAlphaMask(
      [null, '#111111', null, '#222222'],
      new Uint8ClampedArray([0, 71, 72, 255]),
      '#16a34a',
    )

    expect(result).toEqual([null, '#111111', '#16a34a', '#16a34a'])
  })

  it('does not mutate the source pixel buffer', () => {
    const source = [null, null]
    applyTextAlphaMask(source, new Uint8ClampedArray([255, 0]), '#16a34a')
    expect(source).toEqual([null, null])
  })
})
