# Pixel Loop Animation Format

`pixel-loop/v1` is a compact, human-readable interchange format for importing AI-generated pixel animations into Pixel Loop.

## Example

```json
{
  "format": "pixel-loop/v1",
  "size": 16,
  "fps": 6,
  "background": "transparent",
  "palette": {
    "G": "#16a34a"
  },
  "frames": [
    {
      "rows": [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        ".......GG.......",
        ".......GG.......",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................"
      ]
    }
  ]
}
```

## Fields

| Field | Requirement |
| --- | --- |
| `format` | Must be `pixel-loop/v1` |
| `size` | `16`, `32`, or `64` |
| `fps` | Integer from `1` to `24` |
| `background` | `transparent` or a `#RRGGBB` color |
| `palette` | Up to 36 uppercase ASCII letters or digits mapped to `#RRGGBB` |
| `frames` | Between 1 and 100 frame objects |
| `frames[].rows` | Exactly `size` strings, each containing exactly `size` symbols |

`.` is reserved for transparent pixels. Every other symbol used by a row must exist in `palette`. Partial alpha, comments, trailing commas, and Markdown fences are not supported.

Importing this format replaces the current project after confirmation. The first imported frame is loaded into the editor, and all frames are added to the timeline.
