import { EMPTY_PIXEL, PALETTE } from "./palette";

export function createPixels(size: number): Int8Array {
  return new Int8Array(size * size).fill(EMPTY_PIXEL);
}

export function clonePixels(pixels: Int8Array): Int8Array {
  return new Int8Array(pixels);
}

export function pixelsEqual(a: Int8Array, b: Int8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function isCanvasEmpty(pixels: Int8Array): boolean {
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] !== EMPTY_PIXEL) return false;
  }
  return true;
}

export function resizePixels(pixels: Int8Array, fromSize: number, toSize: number): Int8Array {
  const next = createPixels(toSize);
  const copy = Math.min(fromSize, toSize);
  for (let y = 0; y < copy; y++) {
    for (let x = 0; x < copy; x++) {
      next[y * toSize + x] = pixels[y * fromSize + x] ?? EMPTY_PIXEL;
    }
  }
  return next;
}

export function paintCell(
  pixels: Int8Array,
  size: number,
  x: number,
  y: number,
  value: number,
): void {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  pixels[y * size + x] = value;
}

/** Walk every cell on the line so fast strokes never skip pixels. */
export function walkBresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plot: (x: number, y: number) => void,
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    plot(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function floodFill(
  pixels: Int8Array,
  size: number,
  x: number,
  y: number,
  replacement: number,
): void {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const target = pixels[y * size + x];
  if (target === replacement) return;

  const stack: Array<[number, number]> = [[x, y]];
  while (stack.length) {
    const next = stack.pop();
    if (!next) break;
    const [cx, cy] = next;
    if (cx < 0 || cy < 0 || cx >= size || cy >= size) continue;
    const i = cy * size + cx;
    if (pixels[i] !== target) continue;
    pixels[i] = replacement;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

export function downloadPng(pixels: Int8Array, gridSize: number): void {
  const scale = Math.max(12, Math.ceil(640 / gridSize));
  const canvas = document.createElement("canvas");
  canvas.width = gridSize * scale;
  canvas.height = gridSize * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const value = pixels[y * gridSize + x];
      if (value === undefined || value < 0) continue;
      const hex = PALETTE[value];
      if (!hex) continue;
      ctx.fillStyle = hex;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const filename = `pixel-pad-${gridSize}x${gridSize}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    const share =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });
    if (share) {
      navigator.share({ files: [file], title: filename }).catch(() => {
        triggerDownload(blob, filename);
      });
      return;
    }
    triggerDownload(blob, filename);
  }, "image/png");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function pointerToCell(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  gridSize: number,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * gridSize);
  const y = Math.floor(((clientY - rect.top) / rect.height) * gridSize);
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return null;
  return { x, y };
}
