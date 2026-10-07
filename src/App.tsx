import { Download, Redo2, Trash2, Undo2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { DrawingCanvas, type DrawingCanvasHandle, type HistoryState } from "@/components/drawing-canvas"
import { Toolbar } from "@/components/toolbar"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { MAX_SIZE, MIN_SIZE, TOOLS, type ToolId } from "@/lib/tools"

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? "⌘" : "Ctrl"

function ActionButton({
  label,
  shortcut,
  onClick,
  disabled,
  children,
}: {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut && <kbd className="ml-2 rounded bg-white/15 px-1 font-mono text-[10px]">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

export default function App() {
  const canvasRef = useRef<DrawingCanvasHandle>(null)
  const [tool, setTool] = useState<ToolId>("brush")
  const [color, setColor] = useState("#171717")
  const [size, setSize] = useState(6)
  const [history, setHistory] = useState<HistoryState>({ canUndo: false, canRedo: false, isEmpty: true })
  const [ready, setReady] = useState(false)

  const handleClear = useCallback(() => {
    if (history.isEmpty) return
    canvasRef.current?.clear()
    toast("Canvas cleared", {
      action: { label: "Undo", onClick: () => canvasRef.current?.undo() },
    })
  }, [history.isEmpty])

  const handleDownload = useCallback(async () => {
    try {
      await canvasRef.current?.download()
      toast.success("Saved your drawing as a PNG")
    } catch {
      toast.error("Couldn't export the drawing. Please try again.")
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.isContentEditable)) return

      const key = event.key.toLowerCase()
      if (event.metaKey || event.ctrlKey) {
        if (key === "z") {
          event.preventDefault()
          if (event.shiftKey) canvasRef.current?.redo()
          else canvasRef.current?.undo()
        } else if (key === "y") {
          event.preventDefault()
          canvasRef.current?.redo()
        } else if (key === "s") {
          event.preventDefault()
          void handleDownload()
        }
        return
      }
      if (event.altKey) return

      if (key === "[") setSize((s) => Math.max(MIN_SIZE, s - (s > 10 ? 4 : 1)))
      else if (key === "]") setSize((s) => Math.min(MAX_SIZE, s + (s >= 10 ? 4 : 1)))
      else {
        const match = TOOLS.find((t) => t.shortcut.toLowerCase() === key)
        if (match) setTool(match.id)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleDownload])

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-dvh flex-col bg-neutral-100 text-neutral-900">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 md:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-7" />
            <div className="min-w-0">
              <h1 className="text-sm leading-tight font-semibold">Play Canvas</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Sketch freely. Your work saves in this browser automatically.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <ActionButton
              label="Undo"
              shortcut={`${mod} Z`}
              onClick={() => canvasRef.current?.undo()}
              disabled={!history.canUndo}
            >
              <Undo2 />
            </ActionButton>
            <ActionButton
              label="Redo"
              shortcut={`${mod} ⇧ Z`}
              onClick={() => canvasRef.current?.redo()}
              disabled={!history.canRedo}
            >
              <Redo2 />
            </ActionButton>
            <ActionButton label="Clear canvas" onClick={handleClear} disabled={history.isEmpty}>
              <Trash2 />
            </ActionButton>
            <Button className="ml-1.5 h-9 gap-1.5 px-3" onClick={handleDownload} disabled={!ready}>
              <Download />
              <span className="hidden sm:inline">Download PNG</span>
              <span className="sm:hidden">Save</span>
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
          <aside className="shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] md:w-64 md:border-t-0 md:border-r md:pb-0">
            <Toolbar
              tool={tool}
              color={color}
              size={size}
              onToolChange={setTool}
              onColorChange={setColor}
              onSizeChange={setSize}
            />
          </aside>

          <main className="relative min-h-0 flex-1 p-2 md:p-4">
            <DrawingCanvas
              ref={canvasRef}
              tool={tool}
              color={color}
              size={size}
              className="size-full rounded-xl shadow-sm ring-1 ring-black/5"
              onHistoryChange={setHistory}
              onReady={(restored) => {
                setReady(true)
                if (restored) toast("Welcome back — we restored your last drawing.")
              }}
              onStorageError={() =>
                toast.warning("Autosave is full", {
                  description: "Your browser storage is out of space. Download a PNG to keep this drawing.",
                })
              }
            />
            {ready && history.isEmpty && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="max-w-xs text-center">
                  <p className="text-base font-medium text-neutral-700">Your canvas is ready</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Pick a tool and a color, then click and drag (or use your finger) to start drawing.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      <Toaster position="bottom-center" />
    </TooltipProvider>
  )
}
