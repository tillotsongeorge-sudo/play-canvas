# Play Canvas

A playful sketchpad that runs in the browser. Draw with a brush, highlighter or spray can, sketch lines, rectangles and ellipses, then download the result as a PNG. Your drawing autosaves to `localStorage`, so it is still there when you come back.

Live site: https://tillotsongeorge-sudo.github.io/play-canvas/

## Features

- Tools: brush, highlighter, spray paint, eraser, line, rectangle, ellipse
- 12-color palette plus a custom color picker, and brush sizes from 1 to 64 px
- Undo/redo (up to 40 steps), clear with an undo toast, PNG export
- Smooth strokes with mouse, pen or touch; works on phones and tablets
- Keyboard shortcuts:

| Key | Action |
| --- | --- |
| `B` `H` `S` `E` | Brush, highlighter, spray, eraser |
| `L` `R` `O` | Line, rectangle, ellipse |
| `[` / `]` | Smaller / larger brush |
| `Shift` while drawing a shape | Perfect squares, circles, and 45° lines |
| `Ctrl/⌘ Z`, `Ctrl/⌘ Shift Z` | Undo, redo |
| `Ctrl/⌘ S` | Download PNG |

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, and shadcn/ui (Base UI) components. Drawing uses two stacked HTML canvases: a preview layer for the stroke in progress and the main layer it gets committed to.

## Run locally

Requires Node.js 22+.

```bash
npm install
npm run dev      # http://localhost:47321/play-canvas/
```

Other scripts:

```bash
npm run build    # type-check and build to dist/
npm run preview  # serve the production build on port 47322
npm run lint
```

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages. The build uses `/<repo-name>/` as its base path; set `BASE_PATH=/` when hosting at a domain root.

If the first run fails at the Pages step, open **Settings → Pages** in the repository and set **Source** to **GitHub Actions**, then re-run the workflow.
