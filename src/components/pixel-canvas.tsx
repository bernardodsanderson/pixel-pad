import { useCallback, useEffect, useRef } from "react";
import { EMPTY_PIXEL, PALETTE } from "@/lib/palette";
import { useEditor, type Tool } from "@/lib/editor-store";
import {
  clonePixels,
  floodFill,
  isCanvasEmpty,
  paintCell,
  pointerToCell,
  walkBresenham,
} from "@/lib/pixel-utils";
import { cn } from "@/lib/utils";

const CHECKER_A: [number, number, number] = [38, 38, 44];
const CHECKER_B: [number, number, number] = [49, 49, 56];

const PALETTE_RGB: [number, number, number][] = PALETTE.map((hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});

type Cell = { x: number; y: number };

function cellEdge(index: number, side: number, gridSize: number): number {
  return Math.round((index * side) / gridSize);
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  pixels: Int8Array,
  gridSize: number,
  side: number,
  showGrid: boolean,
  hover: Cell | null,
  colorIndex: number,
  tool: Tool,
) {
  if (buffer.width !== gridSize || buffer.height !== gridSize) {
    buffer.width = gridSize;
    buffer.height = gridSize;
  }
  const bufferCtx = buffer.getContext("2d");
  if (!bufferCtx) return;
  const image = bufferCtx.createImageData(gridSize, gridSize);
  const data = image.data;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const i = y * gridSize + x;
      const value = pixels[i] ?? EMPTY_PIXEL;
      const rgb =
        value >= 0 && PALETTE_RGB[value]
          ? PALETTE_RGB[value]
          : (x + y) % 2 === 0
            ? CHECKER_A
            : CHECKER_B;
      const offset = i * 4;
      data[offset] = rgb[0];
      data[offset + 1] = rgb[1];
      data[offset + 2] = rgb[2];
      data[offset + 3] = 255;
    }
  }
  bufferCtx.putImageData(image, 0, 0);

  ctx.clearRect(0, 0, side, side);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, gridSize, gridSize, 0, 0, side, side);

  if (hover) {
    const x0 = cellEdge(hover.x, side, gridSize);
    const y0 = cellEdge(hover.y, side, gridSize);
    const x1 = cellEdge(hover.x + 1, side, gridSize);
    const y1 = cellEdge(hover.y + 1, side, gridSize);
    ctx.save();
    if (tool === "eraser") {
      ctx.fillStyle = "rgba(255,255,255,0.16)";
    } else {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = PALETTE[colorIndex] ?? "#ffffff";
    }
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
  }

  if (showGrid && side / gridSize >= 3) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let i = 1; i < gridSize; i++) {
      const p = cellEdge(i, side, gridSize) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, side);
      ctx.moveTo(0, p);
      ctx.lineTo(side, p);
    }
    ctx.stroke();
  }

  if (isCanvasEmpty(pixels) && !hover) {
    ctx.fillStyle = "rgba(232,228,220,0.55)";
    ctx.font = "500 13px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Draw on the grid", side / 2, side / 2);
  }
}

export function PixelCanvas() {
  const gridSize = useEditor((s) => s.gridSize);
  const pixels = useEditor((s) => s.pixels);
  const tool = useEditor((s) => s.tool);
  const colorIndex = useEditor((s) => s.colorIndex);
  const showGrid = useEditor((s) => s.showGrid);
  const commitPixels = useEditor((s) => s.commitPixels);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<Int8Array>(pixels);
  const drawingRef = useRef(false);
  const lastCellRef = useRef<Cell | null>(null);
  const hoverRef = useRef<Cell | null>(null);
  const paintValueRef = useRef(colorIndex);
  const rafRef = useRef<number | null>(null);
  const sideRef = useRef(320);

  liveRef.current = drawingRef.current ? liveRef.current : pixels;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!bufferRef.current) bufferRef.current = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    const side = sideRef.current;
    const pixelW = Math.round(side * dpr);
    const pixelH = Math.round(side * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
      canvas.style.width = `${side}px`;
      canvas.style.height = `${side}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawFrame(
      ctx,
      bufferRef.current,
      liveRef.current,
      gridSize,
      side,
      showGrid,
      hoverRef.current,
      colorIndex,
      tool,
    );
  }, [colorIndex, gridSize, showGrid, tool]);

  const schedulePaint = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      paint();
    });
  }, [paint]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const next = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
      sideRef.current = Math.max(140, next);
      paint();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    paint();
  }, [paint, pixels]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const applyToolAt = useCallback(
    (cell: Cell, value: number) => {
      if (tool === "fill") {
        floodFill(liveRef.current, gridSize, cell.x, cell.y, value);
        return;
      }
      paintCell(liveRef.current, gridSize, cell.x, cell.y, value);
    },
    [gridSize, tool],
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastCellRef.current = null;
    commitPixels(liveRef.current);
  }, [commitPixels]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0 && event.button !== 2) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cell = pointerToCell(event.clientX, event.clientY, canvas, gridSize);
      if (!cell) return;

      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);

      const erase = tool === "eraser" || event.button === 2;
      const value = erase ? EMPTY_PIXEL : colorIndex;
      paintValueRef.current = value;
      liveRef.current = clonePixels(useEditor.getState().pixels);

      if (tool === "fill" && event.button === 0) {
        applyToolAt(cell, colorIndex);
        drawingRef.current = true;
        schedulePaint();
        endStroke();
        return;
      }

      drawingRef.current = true;
      lastCellRef.current = cell;
      applyToolAt(cell, value);
      schedulePaint();
    },
    [applyToolAt, colorIndex, endStroke, gridSize, schedulePaint, tool],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const native = event.nativeEvent;
      const samples =
        drawingRef.current && typeof native.getCoalescedEvents === "function"
          ? native.getCoalescedEvents()
          : [native];

      const allowHover = native.pointerType === "mouse" || native.pointerType === "pen";
      let hover: Cell | null = allowHover ? hoverRef.current : null;
      for (const sample of samples) {
        const cell = pointerToCell(sample.clientX, sample.clientY, canvas, gridSize);
        if (cell && allowHover) hover = cell;
        if (!drawingRef.current || !cell) continue;
        const last = lastCellRef.current;
        if (last) {
          walkBresenham(last.x, last.y, cell.x, cell.y, (x, y) => {
            paintCell(liveRef.current, gridSize, x, y, paintValueRef.current);
          });
        } else {
          paintCell(liveRef.current, gridSize, cell.x, cell.y, paintValueRef.current);
        }
        lastCellRef.current = cell;
      }

      hoverRef.current = hover;
      schedulePaint();
    },
    [gridSize, schedulePaint],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
        canvasRef.current.releasePointerCapture(event.pointerId);
      }
      endStroke();
      schedulePaint();
    },
    [endStroke, schedulePaint],
  );

  const onPointerLeave = useCallback(() => {
    hoverRef.current = null;
    schedulePaint();
  }, [schedulePaint]);

  const cursor = tool === "fill" ? "cursor-pointer" : "cursor-crosshair";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 p-2 md:p-6">
      <div ref={wrapRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
        <div className="overflow-hidden rounded-md shadow-border">
          <canvas
            ref={canvasRef}
            className={cn("block touch-none select-none bg-well", cursor)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={(event) => event.preventDefault()}
            aria-label={`${gridSize} by ${gridSize} pixel canvas`}
          />
        </div>
      </div>
    </div>
  );
}
