import { describe, expect, it } from 'vitest'
import {
  MAX_CANVAS_DIM,
  centeredOffset,
  clampOffset,
  computeCanvasSize,
  coverScale,
  moveStep,
} from './photoFrames'
import type { PhotoFrame } from '../types'

function frame(overrides: Partial<PhotoFrame> = {}): PhotoFrame {
  return {
    id: 'f',
    src: 'data:,',
    naturalWidth: 800,
    naturalHeight: 600,
    offsetX: 0,
    offsetY: 0,
    createdAt: 0,
    ...overrides,
  }
}

describe('computeCanvasSize', () => {
  it('keeps small images at their native size', () => {
    expect(computeCanvasSize(320, 240)).toEqual({ width: 320, height: 240 })
  })

  it('scales the longest side down to the cap while preserving aspect ratio', () => {
    const size = computeCanvasSize(1200, 800)
    expect(Math.max(size.width, size.height)).toBe(MAX_CANVAS_DIM)
    expect(size).toEqual({ width: 512, height: 341 })
  })

  it('never returns a zero dimension', () => {
    const size = computeCanvasSize(2000, 1)
    expect(size.width).toBeGreaterThanOrEqual(1)
    expect(size.height).toBeGreaterThanOrEqual(1)
  })
})

describe('coverScale', () => {
  it('picks the larger ratio so the image fully covers the canvas', () => {
    // canvas 512x341, image 800x600 -> max(512/800, 341/600) = 0.64
    expect(coverScale(800, 600, { width: 512, height: 341 })).toBeCloseTo(0.64)
  })
})

describe('centeredOffset', () => {
  it('centers a wide image within a square canvas (negative x, zero y)', () => {
    const canvas = { width: 100, height: 100 }
    // cover scale = max(100/200,100/100)=1 -> scaled 200x100, offsetX=(100-200)/2=-50
    const offset = centeredOffset(200, 100, canvas)
    expect(offset).toEqual({ offsetX: -50, offsetY: 0 })
  })
})

describe('clampOffset', () => {
  const canvas = { width: 100, height: 100 } // EDGE_KEEP 0.2 -> keep 20px each axis

  it('allows panning a same-aspect (exact-fit) photo, exposing a gap', () => {
    // square photo in square canvas -> scaled 100x100, range [20-100, 100-20] = [-80, 80]
    const clamped = clampOffset(30, -30, frame({ naturalWidth: 100, naturalHeight: 100 }), canvas)
    expect(clamped).toEqual({ offsetX: 30, offsetY: -30 })
  })

  it('never lets the photo be pushed fully off-screen (keeps 20px visible)', () => {
    // scaled 200x100 -> offsetX range [20-200, 100-20] = [-180, 80]
    const frameWide = frame({ naturalWidth: 200, naturalHeight: 100 })
    expect(clampOffset(9999, 0, frameWide, canvas).offsetX).toBe(80)
    expect(clampOffset(-9999, 0, frameWide, canvas).offsetX).toBe(-180)
  })

  it('keeps an in-range offset untouched', () => {
    const clamped = clampOffset(-30, 10, frame({ naturalWidth: 200, naturalHeight: 100 }), canvas)
    expect(clamped).toEqual({ offsetX: -30, offsetY: 10 })
  })
})

describe('moveStep', () => {
  it('scales with the canvas but stays at least 4px', () => {
    expect(moveStep({ width: 512, height: 341 })).toBe(10)
    expect(moveStep({ width: 50, height: 50 })).toBe(4)
  })
})
