import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clonePixels,
  createPixels,
  downloadPng,
  floodFill,
  isCanvasEmpty,
  paintCell,
  pixelsEqual,
  pointerToCell,
  resizePixels,
  walkBresenham,
} from "./pixel-utils";
import { EMPTY_PIXEL } from "./palette";

describe("createPixels", () => {
  it("creates a square grid filled with EMPTY_PIXEL", () => {
    const pixels = createPixels(8);
    expect(pixels).toHaveLength(64);
    expect(Array.from(pixels)).toEqual(new Array(64).fill(EMPTY_PIXEL));
  });

  it("handles the largest supported grid", () => {
    expect(createPixels(64)).toHaveLength(4096);
  });
});

describe("clonePixels", () => {
  it("returns an independent copy", () => {
    const source = createPixels(4);
    source[3] = 7;
    const copy = clonePixels(source);
    expect(copy).not.toBe(source);
    expect(Array.from(copy)).toEqual(Array.from(source));
    copy[3] = 1;
    expect(source[3]).toBe(7);
  });
});

describe("pixelsEqual", () => {
  it("is true for equal grids", () => {
    const a = createPixels(8);
    const b = createPixels(8);
    a[5] = 3;
    b[5] = 3;
    expect(pixelsEqual(a, b)).toBe(true);
  });

  it("is false when any cell differs", () => {
    const a = createPixels(8);
    const b = createPixels(8);
    a[5] = 3;
    expect(pixelsEqual(a, b)).toBe(false);
  });

  it("is false for different lengths", () => {
    expect(pixelsEqual(createPixels(8), createPixels(16))).toBe(false);
  });
});

describe("isCanvasEmpty", () => {
  it("is true for a fresh grid", () => {
    expect(isCanvasEmpty(createPixels(16))).toBe(true);
  });

  it("is false once a pixel is painted", () => {
    const pixels = createPixels(16);
    pixels[0] = 0;
    expect(isCanvasEmpty(pixels)).toBe(false);
  });

  it("treats values other than -1 as painted", () => {
    const pixels = createPixels(4);
    pixels[0] = -2;
    expect(isCanvasEmpty(pixels)).toBe(false);
  });
});

describe("resizePixels", () => {
  it("copies the top-left region when growing", () => {
    const source = createPixels(4);
    source[0] = 1;
    source[3] = 2;
    const grown = resizePixels(source, 4, 8);
    expect(grown).toHaveLength(64);
    expect(grown[0]).toBe(1);
    expect(grown[3]).toBe(2);
    expect(grown[4 * 8 + 0]).toBe(EMPTY_PIXEL);
  });

  it("crops when shrinking", () => {
    const source = createPixels(8);
    source[0] = 1;
    source[7 * 8 + 7] = 2;
    const shrunk = resizePixels(source, 8, 4);
    expect(shrunk).toHaveLength(16);
    expect(shrunk[0]).toBe(1);
    expect(Array.from(shrunk).slice(1)).toEqual(new Array(15).fill(EMPTY_PIXEL));
  });

  it("returns a fresh grid when the size is unchanged", () => {
    const source = createPixels(4);
    source[2] = 5;
    const same = resizePixels(source, 4, 4);
    expect(Array.from(same)).toEqual(Array.from(source));
    expect(same).not.toBe(source);
  });
});

describe("paintCell", () => {
  it("paints an in-bounds cell", () => {
    const pixels = createPixels(8);
    paintCell(pixels, 8, 2, 3, 9);
    expect(pixels[3 * 8 + 2]).toBe(9);
  });

  it("ignores out-of-bounds coordinates", () => {
    const pixels = createPixels(8);
    paintCell(pixels, 8, -1, 0, 9);
    paintCell(pixels, 8, 0, -1, 9);
    paintCell(pixels, 8, 8, 0, 9);
    paintCell(pixels, 8, 0, 8, 9);
    expect(isCanvasEmpty(pixels)).toBe(true);
  });
});

describe("walkBresenham", () => {
  function collect(x0: number, y0: number, x1: number, y1: number) {
    const points: Array<[number, number]> = [];
    walkBresenham(x0, y0, x1, y1, (x, y) => points.push([x, y]));
    return points;
  }

  it("walks a single point", () => {
    expect(collect(2, 3, 2, 3)).toEqual([[2, 3]]);
  });

  it("walks a horizontal line in order", () => {
    expect(collect(0, 0, 3, 0)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
  });

  it("walks a vertical line", () => {
    expect(collect(1, 2, 1, 0)).toEqual([
      [1, 2],
      [1, 1],
      [1, 0],
    ]);
  });

  it("walks a diagonal line", () => {
    expect(collect(0, 0, 3, 3)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("is symmetric when reversed", () => {
    expect(collect(3, 3, 0, 0)).toEqual(collect(0, 0, 3, 3).reverse());
  });

  it("never skips a cell on a steep line", () => {
    const points = collect(0, 0, 2, 7);
    for (let i = 1; i < points.length; i++) {
      const [px, py] = points[i - 1];
      const [x, y] = points[i];
      expect(Math.abs(x - px)).toBeLessThanOrEqual(1);
      expect(Math.abs(y - py)).toBeLessThanOrEqual(1);
    }
  });
});

describe("floodFill", () => {
  it("fills a connected region and leaves the border", () => {
    const size = 5;
    const pixels = createPixels(size);
    // Vertical wall at x = 2.
    for (let y = 0; y < size; y++) pixels[y * size + 2] = 1;

    floodFill(pixels, size, 0, 0, 7);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(pixels[y * size + x]).toBe(x < 2 ? 7 : x === 2 ? 1 : EMPTY_PIXEL);
      }
    }
  });

  it("does nothing when the target already has the replacement colour", () => {
    const pixels = createPixels(4);
    pixels[5] = 3;
    const before = Array.from(pixels);
    floodFill(pixels, 4, 1, 1, 3);
    expect(Array.from(pixels)).toEqual(before);
  });

  it("does nothing for out-of-bounds starts", () => {
    const pixels = createPixels(4);
    floodFill(pixels, 4, -1, 2, 5);
    floodFill(pixels, 4, 4, 2, 5);
    expect(isCanvasEmpty(pixels)).toBe(true);
  });

  it("does not leak through diagonal gaps", () => {
    const size = 4;
    const pixels = createPixels(size);
    // The two regions touch only at their corners.
    for (let i = 0; i < size; i++) pixels[i * size + i] = 1;
    const at = (x: number, y: number) => pixels[y * size + x];

    floodFill(pixels, size, 0, 1, 9);

    expect(at(0, 1)).toBe(9);
    expect(at(0, 2)).toBe(9);
    expect(at(1, 0)).toBe(EMPTY_PIXEL);
    expect(at(1, 1)).toBe(1);
    expect(at(3, 3)).toBe(1);
  });

  it("fills the whole canvas when there are no walls", () => {
    const pixels = createPixels(16);
    floodFill(pixels, 16, 8, 8, 11);
    expect(isCanvasEmpty(pixels)).toBe(false);
    expect(Array.from(pixels).every((value) => value === 11)).toBe(true);
  });
});

describe("pointerToCell", () => {
  const canvas = {
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 320, height: 320 }),
  } as unknown as HTMLCanvasElement;

  it("maps the top-left corner to cell 0,0", () => {
    expect(pointerToCell(100, 50, canvas, 32)).toEqual({ x: 0, y: 0 });
  });

  it("maps the bottom-right edge to the last cell", () => {
    expect(pointerToCell(419.9, 369.9, canvas, 32)).toEqual({ x: 31, y: 31 });
  });

  it("rejects points outside the canvas", () => {
    expect(pointerToCell(99, 50, canvas, 32)).toBeNull();
    expect(pointerToCell(420, 50, canvas, 32)).toBeNull();
    expect(pointerToCell(100, 370, canvas, 32)).toBeNull();
  });

  it("returns null for a zero-sized canvas", () => {
    const zero = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    } as unknown as HTMLCanvasElement;
    expect(pointerToCell(0, 0, zero, 16)).toBeNull();
  });
});

describe("downloadPng", () => {
  type Fill = { style: string; x: number; y: number; width: number; height: number };

  function stubDom(
    options: {
      context?: boolean;
      blob?: Blob | null;
      navigator?: Record<string, unknown>;
    } = {},
  ) {
    const fills: Fill[] = [];
    const ctx = {
      fillStyle: "",
      fillRect: vi.fn(function (
        this: typeof ctx,
        x: number,
        y: number,
        width: number,
        height: number,
      ) {
        fills.push({ style: this.fillStyle, x, y, width, height });
      }),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => (options.context === false ? null : ctx)),
      toBlob: vi.fn((callback: BlobCallback) => {
        const blob = Object.hasOwn(options, "blob") ? (options.blob ?? null) : new Blob(["png"]);
        callback(blob);
      }),
    };
    const link = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    const body = { appendChild: vi.fn() };
    const documentStub = {
      body,
      createElement: vi.fn((tag: string) => (tag === "canvas" ? canvas : link)),
    };
    const urlStub = {
      createObjectURL: vi.fn(() => "blob:pixel-pad"),
      revokeObjectURL: vi.fn(),
    };

    vi.stubGlobal("document", documentStub);
    vi.stubGlobal("URL", urlStub);
    vi.stubGlobal("navigator", options.navigator ?? {});
    vi.stubGlobal(
      "File",
      class FakeFile {
        constructor(
          readonly parts: Blob[],
          readonly name: string,
          readonly init: FilePropertyBag,
        ) {}
      },
    );

    return { canvas, ctx, link, fills, urlStub, documentStub };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws each painted cell and downloads the result", () => {
    const { canvas, link, fills, urlStub, documentStub } = stubDom();
    const pixels = createPixels(4);
    pixels[0] = 8;
    pixels[5] = 0;

    downloadPng(pixels, 4);

    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(640);
    expect(fills).toEqual([
      { style: "#FF004D", x: 0, y: 0, width: 160, height: 160 },
      { style: "#000000", x: 160, y: 160, width: 160, height: 160 },
    ]);
    expect(link.download).toBe("pixel-pad-4x4.png");
    expect(link.href).toBe("blob:pixel-pad");
    expect(documentStub.body.appendChild).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(link.remove).toHaveBeenCalledTimes(1);
    expect(urlStub.revokeObjectURL).toHaveBeenCalledWith("blob:pixel-pad");
  });

  it("uses the native share sheet when files can be shared", () => {
    const share = vi.fn(async (_payload: { files: unknown[]; title: string }) => {});
    const { link } = stubDom({
      navigator: { share, canShare: vi.fn(() => true) },
    });

    downloadPng(createPixels(8), 8);

    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ title: "pixel-pad-8x8.png" });
    expect(payload?.files).toHaveLength(1);
    expect(link.click).not.toHaveBeenCalled();
  });

  it("falls back to a download when the share sheet rejects", async () => {
    const { link } = stubDom({
      navigator: {
        share: vi.fn(() => Promise.reject(new Error("cancelled"))),
        canShare: vi.fn(() => true),
      },
    });

    downloadPng(createPixels(8), 8);
    await vi.waitFor(() => expect(link.click).toHaveBeenCalledTimes(1));
  });

  it("does not share when the browser cannot share files", () => {
    const share = vi.fn(async () => {});
    const { link } = stubDom({
      navigator: { share, canShare: vi.fn(() => false) },
    });

    downloadPng(createPixels(8), 8);

    expect(share).not.toHaveBeenCalled();
    expect(link.click).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the 2D context is unavailable", () => {
    const { canvas, link } = stubDom({ context: false });
    downloadPng(createPixels(8), 8);
    expect(canvas.toBlob).not.toHaveBeenCalled();
    expect(link.click).not.toHaveBeenCalled();
  });

  it("does nothing when the PNG blob cannot be produced", () => {
    const { link } = stubDom({ blob: null });
    downloadPng(createPixels(8), 8);
    expect(link.click).not.toHaveBeenCalled();
  });
});
