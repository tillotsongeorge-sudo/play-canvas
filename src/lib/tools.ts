import {
  Circle,
  Eraser,
  Highlighter,
  Paintbrush,
  Slash,
  SprayCan,
  Square,
  type LucideIcon,
} from "lucide-react"

export type ToolId =
  | "brush"
  | "marker"
  | "spray"
  | "eraser"
  | "line"
  | "rect"
  | "ellipse"

export type ToolDefinition = {
  id: ToolId
  label: string
  shortcut: string
  icon: LucideIcon
  kind: "freehand" | "spray" | "shape"
  /** Opacity applied when the stroke is committed to the canvas. */
  alpha: number
}

export const TOOLS: ToolDefinition[] = [
  { id: "brush", label: "Brush", shortcut: "B", icon: Paintbrush, kind: "freehand", alpha: 1 },
  { id: "marker", label: "Highlighter", shortcut: "H", icon: Highlighter, kind: "freehand", alpha: 0.35 },
  { id: "spray", label: "Spray paint", shortcut: "S", icon: SprayCan, kind: "spray", alpha: 1 },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser, kind: "freehand", alpha: 1 },
  { id: "line", label: "Line", shortcut: "L", icon: Slash, kind: "shape", alpha: 1 },
  { id: "rect", label: "Rectangle", shortcut: "R", icon: Square, kind: "shape", alpha: 1 },
  { id: "ellipse", label: "Ellipse", shortcut: "O", icon: Circle, kind: "shape", alpha: 1 },
]

export const TOOLS_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<
  ToolId,
  ToolDefinition
>

export const PALETTE = [
  "#171717",
  "#737373",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#92400e",
]

export const PAPER_COLOR = "#ffffff"

export const MIN_SIZE = 1
export const MAX_SIZE = 64
