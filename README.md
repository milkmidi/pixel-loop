# Pixel Loop

Pixel Loop is a local-first pixel animation studio built with React. Draw frame-by-frame pixel art, import images, preview the animation, and export the result as an animated GIF—all in the browser.

## Features

- 16×16, 32×32, and 64×64 pixel canvases
- Pencil, eraser, eyedropper, color picker, and clear-canvas tools
- Mouse, touch, and Apple Pencil support through Pointer Events
- Stroke-based undo and redo history
- Optional pixel grid and integer zoom levels
- Image import through the upload button or drag and drop
- PNG, JPG, WebP, and the first frame of GIF files supported
- Aspect-ratio-preserving, nearest-neighbor image conversion
- AI-agent-friendly `pixel-loop/v1` animation JSON import
- Live JSON validation with frame, row, and column error messages
- Snapshot-based animation workflow
- Frame editing, duplication, deletion, and drag-to-reorder
- Animation preview with adjustable playback speed from 1–24 FPS
- GIF export at 1×, 2×, 4×, or 8× scale
- Transparent or custom-color GIF backgrounds
- Automatic IndexedDB saving with no account or backend
- Complete project reset with confirmation

## Getting Started

### Requirements

- Node.js 22 or later recommended
- npm

### Installation

```bash
git clone git@github.com:milkmidi/pixel-loop.git
cd pixel-loop
npm install
npm run dev
```

Open the local URL printed by Vite, usually <http://localhost:5173>.

## Usage

### Draw

1. Choose a canvas resolution.
2. Select the Pencil tool and a color.
3. Draw directly on the canvas.
4. Use Snapshot to save the current canvas as an animation frame.
5. Keep editing the retained canvas to create the next frame.

### Import an Image

Use either method:

- Select **Upload image** in the header.
- Drag an image directly onto the canvas.

The image is centered, scaled to fit the current canvas without changing its aspect ratio, and converted into editable pixels. Importing over painted content requires confirmation and can be undone.

### Import an AI-Generated Animation

1. Give [the agent instructions](docs/PIXEL_LOOP_AGENT_INSTRUCTIONS.md) to Codex, Claude Code, or another AI agent.
2. Ask it to generate an animation and return only `pixel-loop/v1` JSON.
3. Select **Import JSON** in Pixel Loop.
4. Paste the generated JSON and review the live validation summary.
5. Select **Import animation** to replace the current project.

The format uses compact palette symbols and fixed-width rows, making it readable, token-efficient, and easy to validate. See the complete [format specification](docs/pixel-loop-format.md) and [JSON Schema](docs/pixel-loop.schema.json).

### Work with Frames

- Select a frame thumbnail to edit it.
- Use **Update Frame** to save changes back to the selected frame.
- Drag frames to reorder them.
- Duplicate or delete frames from the timeline.
- Up to 100 frames are supported; a performance warning appears at 80 frames.

### Export a GIF

1. Choose the FPS, output scale, and background behavior.
2. Select **Export GIF**.
3. If the canvas has unsaved changes, choose whether to append it as the final exported frame.

GIFs use nearest-neighbor scaling, preserve crisp pixel edges, and loop forever.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `P` | Pencil |
| `E` | Eraser |
| `I` | Eyedropper |
| `Space` | Create a snapshot |
| `Arrow keys` | Move all canvas pixels by one cell |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |

Shortcuts are disabled while an input, select, or button has focus.

## Local Data

Pixel Loop is local-first:

- Images and project data are not uploaded to a server.
- The current project is automatically stored in IndexedDB.
- Reloading the page restores the saved canvas, frames, and settings.
- **Reset entire project** clears the canvas, frames, history, and settings after confirmation.

## Development

```bash
# Run the development server
npm run dev

# Run the test suite
npm test

# Type-check the project
npm run lint

# Create a production build
npm run build
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- gifenc
- dnd-kit
- Lucide React
- Vitest

## Project Structure

```text
src/
├── components/       UI, canvas, preview, timeline, and dialogs
├── hooks/            Reusable pixel history state
├── lib/              Pixel, image import, GIF export, and storage logic
├── App.tsx           Application state and workflows
├── styles.css        Tailwind entrypoint and shared visual styles
└── types.ts          Project and animation types

docs/
├── PIXEL_LOOP_AGENT_INSTRUCTIONS.md
├── pixel-loop-format.md
└── pixel-loop.schema.json
```
