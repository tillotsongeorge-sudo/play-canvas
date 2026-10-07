import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { PAPER_COLOR, TOOLS_BY_ID, type ToolId } from "@/lib/tools"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "play-canvas:drawing"
const HISTORY_LIMIT = 40
const AUTOSAVE_DELAY_MS = 400

type Point = { x: number; y: number }

type Snapshot = { image: ImageData; empty: boolean }

export type HistoryState = { canUndo: boolean; canRedo: boolean; isEmpty: boolean }

export type DrawingCanvasHandle = {
  undo: () => void
  redo: () => void
  clear: () => void
  download: () => Promise<void>
}

type DrawingCanvasProps = {
  tool: ToolId
  color: string
  size: number
  className?: string
  onHistoryChange?: (state: HistoryState) => void
  onReady?: (restored: boolean) => void
  onStorageError?: () => void
}

function smoothPath(ctx: CanvasRenderingContext2D, points: Point[], size: number) {
  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

function constrain(start: Point, end: Point, tool: ToolId): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (tool === "line") {
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    const length = Math.hypot(dx, dy)
    return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length }
  }
  const side = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: start.x + Math.sign(dx || 1) * side, y: start.y + Math.sign(dy || 1) * side }
}

function drawShape(ctx: CanvasRenderingContext2D, tool: ToolId, start: Point, end: Point) {
  ctx.beginPath()
  if (tool === "line") {
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
  } else if (tool === "rect") {
    ctx.rect(
      Math.min(start.x, end.x),
      Math.min(start.y, end.y),
      Math.abs(end.x - start.x),
      Math.abs(end.y - start.y),
    )
  } else {
    ctx.ellipse(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      Math.abs(end.x - start.x) / 2,
      Math.abs(end.y - start.y) / 2,
      0,
      0,
      Math.PI * 2,
    )
  }
  ctx.stroke()
}

function sprayAt(ctx: CanvasRenderingContext2D, at: Point, size: number) {
  const radius = Math.max(4, size * 1.5)
  const dots = Math.ceil(radius * 1.2)
  for (let i = 0; i < dots; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * radius
    ctx.fillRect(at.x + Math.cos(angle) * r, at.y + Math.sin(angle) * r, 1.2, 1.2)
  }
}

function timestamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    { tool, color, size, className, onHistoryChange, onReady, onStorageError },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const previewRef = useRef<HTMLCanvasElement>(null)
    const cursorRef = useRef<HTMLDivElement>(null)

    const logicalSize = useRef({ width: 0, height: 0 })
    const dpr = useRef(1)
    const history = useRef<Snapshot[]>([])
    const historyIndex = useRef(-1)
    const initialized = useRef(false)
    const saveTimer = useRef<number | undefined>(undefined)
    const storageErrorShown = useRef(false)

    const stroke = useRef<{
      pointerId: number
      tool: ToolId
      start: Point
      last: Point
      points: Point[]
      shift: boolean
    } | null>(null)
    const sprayFrame = useRef<number | undefined>(undefined)

    const [ready, setReady] = useState(false)

    const callbacks = useRef({ onHistoryChange, onReady, onStorageError })
    useLayoutEffect(() => {
      callbacks.current = { onHistoryChange, onReady, onStorageError }
    })

    const getMainContext = () => canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null
    const getPreviewContext = () => previewRef.current?.getContext("2d") ?? null

    const emitHistory = useCallback(() => {
      const current = history.current[historyIndex.current]
      callbacks.current.onHistoryChange?.({
        canUndo: historyIndex.current > 0,
        canRedo: historyIndex.current < history.current.length - 1,
        isEmpty: current?.empty ?? true,
      })
    }, [])

    const scheduleSave = useCallback(() => {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        const canvas = canvasRef.current
        const current = history.current[historyIndex.current]
        if (!canvas || !current) return
        try {
          if (current.empty) {
            localStorage.removeItem(STORAGE_KEY)
          } else {
            localStorage.setItem(STORAGE_KEY, canvas.toDataURL("image/png"))
          }
        } catch {
          if (!storageErrorShown.current) {
            storageErrorShown.current = true
            callbacks.current.onStorageError?.()
          }
        }
      }, AUTOSAVE_DELAY_MS)
    }, [])

    const pushSnapshot = useCallback(
      (empty: boolean) => {
        const canvas = canvasRef.current
        const ctx = getMainContext()
        if (!canvas || !ctx) return
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        history.current = history.current.slice(0, historyIndex.current + 1)
        history.current.push({ image, empty })
        if (history.current.length > HISTORY_LIMIT) history.current.shift()
        historyIndex.current = history.current.length - 1
        emitHistory()
        scheduleSave()
      },
      [emitHistory, scheduleSave],
    )

    const restoreSnapshot = useCallback(
      (index: number) => {
        const canvas = canvasRef.current
        const ctx = getMainContext()
        const snapshot = history.current[index]
        if (!canvas || !ctx || !snapshot) return
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = PAPER_COLOR
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
        ctx.putImageData(snapshot.image, 0, 0)
        historyIndex.current = index
        emitHistory()
        scheduleSave()
      },
      [emitHistory, scheduleSave],
    )

    const resize = useCallback((width: number, height: number) => {
      const canvas = canvasRef.current
      const preview = previewRef.current
      if (!canvas || !preview) return

      // Grow-only so shrinking the window (or rotating a phone) never crops the drawing.
      const nextWidth = Math.max(logicalSize.current.width, Math.ceil(width))
      const nextHeight = Math.max(logicalSize.current.height, Math.ceil(height))
      if (nextWidth === logicalSize.current.width && nextHeight === logicalSize.current.height) {
        return
      }

      const ratio = window.devicePixelRatio || 1
      let previous: HTMLCanvasElement | null = null
      if (canvas.width > 0 && canvas.height > 0) {
        previous = document.createElement("canvas")
        previous.width = canvas.width
        previous.height = canvas.height
        previous.getContext("2d")?.drawImage(canvas, 0, 0)
      }

      for (const el of [canvas, preview]) {
        el.width = Math.round(nextWidth * ratio)
        el.height = Math.round(nextHeight * ratio)
        el.style.width = `${nextWidth}px`
        el.style.height = `${nextHeight}px`
      }

      const ctx = getMainContext()
      if (ctx) {
        ctx.fillStyle = PAPER_COLOR
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        if (previous) ctx.drawImage(previous, 0, 0)
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      }
      getPreviewContext()?.setTransform(ratio, 0, 0, ratio, 0, 0)

      logicalSize.current = { width: nextWidth, height: nextHeight }
      dpr.current = ratio
    }, [])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) return
        resize(width, height)

        if (initialized.current) return
        initialized.current = true

        const saved = (() => {
          try {
            return localStorage.getItem(STORAGE_KEY)
          } catch {
            return null
          }
        })()

        const finish = (restored: boolean) => {
          pushSnapshot(!restored)
          history.current = history.current.slice(-1)
          historyIndex.current = 0
          emitHistory()
          setReady(true)
          callbacks.current.onReady?.(restored)
        }

        if (!saved) {
          finish(false)
          return
        }

        const image = new Image()
        image.onload = () => {
          const ctx = getMainContext()
          if (ctx) {
            ctx.save()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.drawImage(image, 0, 0)
            ctx.restore()
          }
          finish(true)
        }
        image.onerror = () => finish(false)
        image.src = saved
      })

      observer.observe(container)
      return () => observer.disconnect()
    }, [emitHistory, pushSnapshot, resize])

    useEffect(() => {
      const flush = () => {
        if (saveTimer.current === undefined) return
        window.clearTimeout(saveTimer.current)
        const canvas = canvasRef.current
        const current = history.current[historyIndex.current]
        if (!canvas || !current) return
        try {
          if (current.empty) localStorage.removeItem(STORAGE_KEY)
          else localStorage.setItem(STORAGE_KEY, canvas.toDataURL("image/png"))
        } catch {
          // Quota errors were already surfaced by scheduleSave.
        }
      }
      window.addEventListener("pagehide", flush)
      return () => {
        window.removeEventListener("pagehide", flush)
        window.clearTimeout(saveTimer.current)
        if (sprayFrame.current) cancelAnimationFrame(sprayFrame.current)
      }
    }, [])

    const toLocal = (event: React.PointerEvent | PointerEvent): Point => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const styleContext = (ctx: CanvasRenderingContext2D, activeTool: ToolId) => {
      const paint = activeTool === "eraser" ? PAPER_COLOR : color
      ctx.strokeStyle = paint
      ctx.fillStyle = paint
      ctx.lineWidth = activeTool === "marker" ? size * 2 : size
      ctx.lineCap = activeTool === "marker" ? "square" : "round"
      ctx.lineJoin = "round"
    }

    const clearPreview = () => {
      const preview = previewRef.current
      const ctx = getPreviewContext()
      if (!preview || !ctx) return
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, preview.width, preview.height)
      ctx.restore()
    }

    const renderPreview = () => {
      const current = stroke.current
      const ctx = getPreviewContext()
      if (!current || !ctx) return
      const definition = TOOLS_BY_ID[current.tool]
      if (definition.kind === "spray") return
      clearPreview()
      styleContext(ctx, current.tool)
      if (definition.kind === "freehand") {
        smoothPath(ctx, current.points, ctx.lineWidth)
      } else {
        const end = current.shift ? constrain(current.start, current.last, current.tool) : current.last
        drawShape(ctx, current.tool, current.start, end)
      }
    }

    const sprayLoop = () => {
      const current = stroke.current
      const ctx = getPreviewContext()
      if (!current || !ctx || current.tool !== "spray") return
      sprayAt(ctx, current.last, size)
      sprayFrame.current = requestAnimationFrame(sprayLoop)
    }

    const commitStroke = () => {
      const current = stroke.current
      const canvas = canvasRef.current
      const preview = previewRef.current
      const ctx = getMainContext()
      stroke.current = null
      if (sprayFrame.current) cancelAnimationFrame(sprayFrame.current)
      if (!current || !canvas || !preview || !ctx) return

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = TOOLS_BY_ID[current.tool].alpha
      ctx.drawImage(preview, 0, 0)
      ctx.restore()
      clearPreview()
      if (previewRef.current) previewRef.current.style.opacity = "1"

      const wasEmpty = history.current[historyIndex.current]?.empty ?? true
      pushSnapshot(wasEmpty && current.tool === "eraser")
    }

    const moveCursor = (event: React.PointerEvent) => {
      const cursor = cursorRef.current
      if (!cursor) return
      if (event.pointerType !== "mouse") {
        cursor.style.opacity = "0"
        return
      }
      const point = toLocal(event)
      const diameter = Math.max(6, tool === "marker" ? size * 2 : tool === "spray" ? size * 3 : size)
      cursor.style.width = `${diameter}px`
      cursor.style.height = `${diameter}px`
      cursor.style.transform = `translate(${point.x - diameter / 2}px, ${point.y - diameter / 2}px)`
      cursor.style.opacity = "1"
    }

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!ready || stroke.current) return
      if (event.pointerType === "mouse" && event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      const point = toLocal(event)
      stroke.current = {
        pointerId: event.pointerId,
        tool,
        start: point,
        last: point,
        points: [point],
        shift: event.shiftKey,
      }
      if (previewRef.current) {
        previewRef.current.style.opacity = String(TOOLS_BY_ID[tool].alpha)
      }
      if (tool === "spray") {
        const ctx = getPreviewContext()
        if (ctx) styleContext(ctx, "spray")
        sprayLoop()
      } else {
        renderPreview()
      }
    }

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      moveCursor(event)
      const current = stroke.current
      if (!current || current.pointerId !== event.pointerId) return
      const events =
        typeof event.nativeEvent.getCoalescedEvents === "function"
          ? event.nativeEvent.getCoalescedEvents()
          : []
      const points = events.length ? events.map(toLocal) : [toLocal(event)]
      current.points.push(...points)
      current.last = points[points.length - 1]
      current.shift = event.shiftKey
      renderPreview()
    }

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (stroke.current?.pointerId !== event.pointerId) return
      commitStroke()
    }

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          if (historyIndex.current > 0) restoreSnapshot(historyIndex.current - 1)
        },
        redo: () => {
          if (historyIndex.current < history.current.length - 1) {
            restoreSnapshot(historyIndex.current + 1)
          }
        },
        clear: () => {
          const canvas = canvasRef.current
          const ctx = getMainContext()
          if (!canvas || !ctx) return
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.fillStyle = PAPER_COLOR
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.restore()
          pushSnapshot(true)
        },
        download: () =>
          new Promise<void>((resolve, reject) => {
            const canvas = canvasRef.current
            const container = containerRef.current
            if (!canvas || !container) return reject(new Error("Canvas is not ready"))
            // Export only the visible area, not the extra space kept from earlier, larger layouts.
            const ratio = dpr.current
            const width = Math.round(container.clientWidth * ratio)
            const height = Math.round(container.clientHeight * ratio)
            const out = document.createElement("canvas")
            out.width = width
            out.height = height
            out.getContext("2d")?.drawImage(canvas, 0, 0, width, height, 0, 0, width, height)
            out.toBlob((blob) => {
              if (!blob) return reject(new Error("Could not encode PNG"))
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = `play-canvas-${timestamp()}.png`
              link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
              resolve()
            }, "image/png")
          }),
      }),
      [pushSnapshot, restoreSnapshot],
    )

    return (
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden bg-white", className)}
      >
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          aria-label="Drawing canvas"
          role="img"
        />
        <canvas
          ref={previewRef}
          className="absolute top-0 left-0 cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            if (cursorRef.current) cursorRef.current.style.opacity = "0"
          }}
        />
        <div
          ref={cursorRef}
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 rounded-full border border-neutral-900/60 opacity-0 shadow-[0_0_0_1px_rgba(255,255,255,0.8)] transition-opacity"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-orange-500" />
              Getting your canvas ready…
            </div>
          </div>
        )}
      </div>
    )
  },
)
