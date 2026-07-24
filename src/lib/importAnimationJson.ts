import { RESOLUTIONS, type Pixel, type Resolution } from '../types'

export interface ParsedAnimation {
  resolution: Resolution
  fps: number
  transparentBackground: boolean
  backgroundColor: string
  palette: Record<string, string>
  frames: Pixel[][]
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const PALETTE_SYMBOL = /^[A-Z0-9]$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(message: string): never {
  throw new Error(message)
}

export function parseAnimationJson(source: string): ParsedAnimation {
  let data: unknown
  try {
    data = JSON.parse(source)
  } catch {
    return fail('Invalid JSON. Check for missing commas, quotes, or brackets.')
  }

  if (!isRecord(data)) fail('The root value must be a JSON object.')
  if (data.format !== 'pixel-loop/v1') {
    fail('Unsupported format. Expected "pixel-loop/v1".')
  }

  if (
    typeof data.size !== 'number' ||
    !RESOLUTIONS.includes(data.size as Resolution)
  ) {
    fail('Size must be 16, 32, or 64.')
  }
  const resolution = data.size as Resolution

  if (
    typeof data.fps !== 'number' ||
    !Number.isInteger(data.fps) ||
    data.fps < 1 ||
    data.fps > 24
  ) {
    fail('FPS must be an integer from 1 to 24.')
  }

  if (typeof data.background !== 'string') {
    fail('Background must be "transparent" or a #RRGGBB color.')
  }
  const transparentBackground = data.background === 'transparent'
  if (!transparentBackground && !HEX_COLOR.test(data.background)) {
    fail('Background must be "transparent" or a #RRGGBB color.')
  }

  if (!isRecord(data.palette)) fail('Palette must be a JSON object.')
  const paletteEntries = Object.entries(data.palette)
  if (paletteEntries.length > 36) fail('Palette cannot contain more than 36 colors.')

  const palette: Record<string, string> = {}
  paletteEntries.forEach(([symbol, color]) => {
    if (!PALETTE_SYMBOL.test(symbol)) {
      fail(`Invalid palette symbol "${symbol}". Use one uppercase letter or digit.`)
    }
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
      fail(`Palette color "${symbol}" must use #RRGGBB.`)
    }
    palette[symbol] = color.toLowerCase()
  })

  if (!Array.isArray(data.frames) || data.frames.length < 1 || data.frames.length > 100) {
    fail('Frames must contain between 1 and 100 items.')
  }

  const frames = data.frames.map((frame, frameIndex) => {
    const frameNumber = frameIndex + 1
    if (!isRecord(frame) || !Array.isArray(frame.rows)) {
      return fail(`Frame ${frameNumber} must contain a rows array.`)
    }
    if (frame.rows.length !== resolution) {
      return fail(
        `Frame ${frameNumber} has ${frame.rows.length} rows; expected ${resolution}.`,
      )
    }

    const pixels: Pixel[] = []
    frame.rows.forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 1
      if (typeof row !== 'string') {
        fail(`Frame ${frameNumber}, row ${rowNumber} must be a string.`)
      }
      if (row.length !== resolution) {
        fail(
          `Frame ${frameNumber}, row ${rowNumber} has ${row.length} pixels; expected ${resolution}.`,
        )
      }

      Array.from(row).forEach((symbol, columnIndex) => {
        if (symbol === '.') {
          pixels.push(null)
          return
        }
        const color = palette[symbol]
        if (!color) {
          fail(
            `Frame ${frameNumber}, row ${rowNumber}, column ${columnIndex + 1} uses undefined palette symbol "${symbol}".`,
          )
        }
        pixels.push(color)
      })
    })
    return pixels
  })

  return {
    resolution,
    fps: data.fps,
    transparentBackground,
    backgroundColor: transparentBackground ? '#ffffff' : data.background.toLowerCase(),
    palette,
    frames,
  }
}
