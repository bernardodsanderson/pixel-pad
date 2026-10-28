import { useEffect, useRef } from "react";
import { FilePlus, Trash2, X } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { PALETTE, EMPTY_PIXEL } from "@/lib/palette";
import type { DrawingRecord } from "@/lib/drawings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SpriteThumb({ pixels, gridSize }: { pixels: number[]; gridSize: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = gridSize;
    canvas.height = gridSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(gridSize, gridSize);
    const data = image.data;
    for (let i = 0; i < pixels.length; i++) {
      const value = pixels[i] ?? EMPTY_PIXEL;
      const hex = value >= 0 ? PALETTE[value] : null;
      let r = 38,
        g = 38,
        b = 44;
      if (hex) {
        const n = Number.parseInt(hex.slice(1), 16);
        r = (n >> 16) & 255;
        g = (n >> 8) & 255;
        b = n & 255;
      } else if ((Math.floor(i / gridSize) + (i % gridSize)) % 2) {
        r = 49;
        g = 49;
        b = 56;
      }
      const o = i * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }, [pixels, gridSize]);

  return (
    <canvas
      ref={ref}
      className="size-12 shrink-0 rounded-sm bg-well"
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
}

export function CloudLibrary({
  open,
  drawings,
  activeId,
  title,
  saving,
  error,
  onClose,
  onTitleChange,
  onNew,
  onOpen,
  onDelete,
}: {
  open: boolean;
  drawings: DrawingRecord[];
  activeId: string | null;
  title: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onTitleChange: (title: string) => void;
  onNew: () => void;
  onOpen: (drawing: DrawingRecord) => void;
  onDelete: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close library"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Saved sprites"
        className="relative flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-border"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-medium">Library</h2>
            <p className="text-xs text-muted-foreground">
              {drawings.length === 1 ? "1 sprite" : `${drawings.length} sprites`} · saved to your
              account
            </p>
          </div>
          <Button variant="ghost" size="iconSm" aria-label="Close library" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="border-b border-border px-4 py-3">
          <Button className="w-full" onClick={onNew}>
            <FilePlus />
            New drawing
          </Button>
        </div>

        <label className="block border-b border-border px-4 py-3">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Sprite name
          </span>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            maxLength={48}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {error ? <p className="px-4 py-2 text-sm text-destructive">{error}</p> : null}

        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {drawings.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              {saving ? "Saving…" : "Nothing saved yet."}
            </li>
          ) : (
            drawings.map((drawing) => (
              <li key={drawing.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2",
                    drawing.id === activeId ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => onOpen(drawing)}
                  >
                    <SpriteThumb pixels={drawing.pixels} gridSize={drawing.gridSize} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{drawing.title}</span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {drawing.gridSize}×{drawing.gridSize}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label={`Delete ${drawing.title}`}
                    onClick={() => onDelete(drawing.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="border-t border-border px-4 py-3">
          <UserButton />
        </div>
      </aside>
    </div>
  );
}
