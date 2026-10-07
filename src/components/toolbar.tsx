import { Check, Pipette } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MAX_SIZE, MIN_SIZE, PALETTE, TOOLS, type ToolId } from "@/lib/tools"
import { cn } from "@/lib/utils"

type ToolbarProps = {
  tool: ToolId
  color: string
  size: number
  onToolChange: (tool: ToolId) => void
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
}

function readableOn(hex: string) {
  const value = parseInt(hex.slice(1), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? "#171717" : "#ffffff"
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:block">
      {children}
    </span>
  )
}

export function Toolbar({
  tool,
  color,
  size,
  onToolChange,
  onColorChange,
  onSizeChange,
}: ToolbarProps) {
  const isCustomColor = !PALETTE.includes(color.toLowerCase())

  return (
    <div className="flex items-center gap-4 overflow-x-auto px-3 py-3 md:flex-col md:items-stretch md:gap-5 md:overflow-x-visible md:overflow-y-auto md:px-4 md:py-5">
      <section className="flex shrink-0 flex-col gap-2" aria-label="Tools">
        <SectionLabel>Tools</SectionLabel>
        <div className="flex gap-1 md:grid md:grid-cols-4" role="radiogroup" aria-label="Drawing tool">
          {TOOLS.map((item) => {
            const Icon = item.icon
            const active = item.id === tool
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={item.label}
                      onClick={() => onToolChange(item.id)}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-transparent text-neutral-600 hover:bg-muted hover:text-neutral-900",
                      )}
                    />
                  }
                >
                  <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {item.label}
                  <kbd className="ml-2 rounded bg-white/15 px-1 font-mono text-[10px]">{item.shortcut}</kbd>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </section>

      <Separator orientation="vertical" className="h-8 md:hidden" />
      <Separator className="hidden md:block" />

      <section className="flex shrink-0 flex-col gap-2" aria-label="Colors">
        <SectionLabel>Color</SectionLabel>
        <div className="flex gap-1.5 md:grid md:grid-cols-6" role="radiogroup" aria-label="Color">
          {PALETTE.map((swatch) => {
            const active = swatch === color.toLowerCase()
            return (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`Color ${swatch}`}
                onClick={() => onColorChange(swatch)}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 md:size-7",
                  active && "ring-2 ring-neutral-900",
                )}
                style={{ backgroundColor: swatch }}
              >
                {active && <Check className="size-3.5" style={{ color: readableOn(swatch) }} strokeWidth={3} />}
              </button>
            )
          })}
          <label
            className={cn(
              "relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110 focus-within:ring-3 focus-within:ring-ring/50 md:size-7",
              isCustomColor
                ? "ring-2 ring-neutral-900"
                : "bg-[conic-gradient(#ef4444,#facc15,#22c55e,#3b82f6,#a855f7,#ef4444)]",
            )}
            style={isCustomColor ? { backgroundColor: color } : undefined}
            title="Pick any color"
          >
            <Pipette
              className="size-3.5"
              style={{ color: isCustomColor ? readableOn(color) : "#ffffff" }}
              strokeWidth={2.5}
            />
            <input
              type="color"
              value={color}
              onChange={(event) => onColorChange(event.target.value)}
              aria-label="Custom color"
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </section>

      <Separator orientation="vertical" className="h-8 md:hidden" />
      <Separator className="hidden md:block" />

      <section className="flex w-44 shrink-0 flex-col gap-2 md:w-auto" aria-label="Brush size">
        <div className="flex items-center justify-between">
          <SectionLabel>Size</SectionLabel>
          <span className="text-xs text-muted-foreground tabular-nums md:ml-auto">{size}px</span>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            value={[size]}
            min={MIN_SIZE}
            max={MAX_SIZE}
            step={1}
            onValueChange={(value) => onSizeChange(Array.isArray(value) ? value[0] : (value as number))}
            aria-label="Brush size"
          />
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-white">
            <span
              className="block rounded-full"
              style={{
                width: Math.max(2, Math.min(32, size / 2)),
                height: Math.max(2, Math.min(32, size / 2)),
                backgroundColor: tool === "eraser" ? "#d4d4d4" : color,
              }}
            />
          </div>
        </div>
      </section>

      <p className="hidden text-xs leading-relaxed text-muted-foreground md:mt-auto md:block">
        Hold <kbd className="rounded border bg-muted px-1 font-mono">Shift</kbd> to draw perfect squares,
        circles and 45° lines. Use <kbd className="rounded border bg-muted px-1 font-mono">[</kbd>{" "}
        <kbd className="rounded border bg-muted px-1 font-mono">]</kbd> to resize.
      </p>
    </div>
  )
}
