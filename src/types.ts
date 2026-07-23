export const RESOLUTIONS = [16, 32, 64] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export type Pixel = string | null
export type DrawingTool = 'pencil' | 'eraser' | 'eyedropper' | 'text'

export interface PixelTextPlacement {
  text: string
  x: number
  y: number
  fontSize: number
  color: string
}

export interface PixelTextBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface AnimationFrame {
  id: string
  pixels: Pixel[]
  createdAt: number
}

export interface ProjectState {
  version: 1
  resolution: Resolution
  pixels: Pixel[]
  baselinePixels: Pixel[]
  frames: AnimationFrame[]
  editingFrameId: string | null
  color: string
  fps: number
  exportScale: number
  zoom: number
  showGrid: boolean
  transparentBackground: boolean
  backgroundColor: string
}
