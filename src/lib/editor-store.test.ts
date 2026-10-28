import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GRID_SIZE, EMPTY_PIXEL, type GridSize } from "./palette";
import { createPixels } from "./pixel-utils";
import { useEditor } from "./editor-store";

const STORAGE_KEY = "pixel-pad-v1";

class MemoryStorage {
  private readonly map = new Map<string, string>();
  failWrites = false;

  get length() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }

  getItem(key: string) {
    return this.map.get(key) ?? null;
  }

  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.map.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.map.set(key, value);
  }
}

let storage: MemoryStorage;

function resetStore() {
  storage.clear();
  storage.failWrites = false;
  useEditor.setState({
    gridSize: DEFAULT_GRID_SIZE,
    pixels: createPixels(DEFAULT_GRID_SIZE),
    tool: "pencil",
    colorIndex: 8,
    showGrid: true,
    past: [],
    future: [],
  });
}

function painted(size: GridSize, cells: Array<[number, number, number]>) {
  const pixels = createPixels(size);
  for (const [x, y, value] of cells) pixels[y * size + x] = value;
  return pixels;
}

beforeAll(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("localStorage", storage);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  resetStore();
});

describe("initial state", () => {
  it("starts with a 32×32 empty canvas and sensible defaults", () => {
    const state = useEditor.getState();
    expect(state.gridSize).toBe(32);
    expect(state.pixels).toHaveLength(32 * 32);
    expect(state.pixels.every((value) => value === EMPTY_PIXEL)).toBe(true);
    expect(state.tool).toBe("pencil");
    expect(state.colorIndex).toBe(8);
    expect(state.showGrid).toBe(true);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });
});

describe("tool and colour", () => {
  it("switches tools", () => {
    useEditor.getState().setTool("fill");
    expect(useEditor.getState().tool).toBe("fill");
  });

  it("accepts every palette index", () => {
    for (const index of [0, 8, 15]) {
      useEditor.getState().setColorIndex(index);
      expect(useEditor.getState().colorIndex).toBe(index);
    }
  });

  it("rejects out-of-range colour indexes", () => {
    useEditor.getState().setColorIndex(-1);
    expect(useEditor.getState().colorIndex).toBe(8);
    useEditor.getState().setColorIndex(16);
    expect(useEditor.getState().colorIndex).toBe(8);
  });

  it("toggles the grid and persists the choice", () => {
    useEditor.getState().toggleGrid();
    expect(useEditor.getState().showGrid).toBe(false);
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}").showGrid).toBe(false);
    useEditor.getState().toggleGrid();
    expect(useEditor.getState().showGrid).toBe(true);
  });

  it("survives a storage write failure", () => {
    storage.failWrites = true;
    expect(() => useEditor.getState().toggleGrid()).not.toThrow();
    expect(useEditor.getState().showGrid).toBe(false);
  });
});

describe("grid size", () => {
  it("resizes the canvas and records one history step", () => {
    const pixels = painted(16, [[1, 2, 8]]);
    useEditor.setState({ gridSize: 16, pixels, past: [], future: [] });

    useEditor.getState().setGridSize(24);

    const state = useEditor.getState();
    expect(state.gridSize).toBe(24);
    expect(state.pixels[2 * 24 + 1]).toBe(8);
    expect(state.past).toHaveLength(1);
    expect(state.past[0]?.gridSize).toBe(16);
    expect(state.future).toEqual([]);
  });

  it("does nothing when the size is unchanged", () => {
    useEditor.getState().setGridSize(32);
    expect(useEditor.getState().past).toEqual([]);
  });

  it("restores the previous size and pixels with undo", () => {
    const pixels = painted(16, [[1, 2, 8]]);
    useEditor.setState({ gridSize: 16, pixels, past: [], future: [] });

    useEditor.getState().setGridSize(32);
    useEditor.getState().undo();

    const state = useEditor.getState();
    expect(state.gridSize).toBe(16);
    expect(state.pixels).toHaveLength(16 * 16);
    expect(state.pixels[2 * 16 + 1]).toBe(8);
  });
});

describe("commitPixels", () => {
  it("stores a clone and records history", () => {
    const next = painted(32, [[4, 5, 9]]);
    useEditor.getState().commitPixels(next);

    expect(useEditor.getState().pixels[5 * 32 + 4]).toBe(9);
    expect(useEditor.getState().past).toHaveLength(1);

    next[5 * 32 + 4] = 1;
    expect(useEditor.getState().pixels[5 * 32 + 4]).toBe(9);
  });

  it("does not record history for an identical canvas", () => {
    const pixels = useEditor.getState().pixels;
    useEditor.getState().commitPixels(pixels);
    expect(useEditor.getState().past).toEqual([]);
  });

  it("clears the redo stack after a new edit", () => {
    useEditor.getState().commitPixels(painted(32, [[0, 0, 1]]));
    useEditor.getState().commitPixels(painted(32, [[0, 0, 2]]));
    useEditor.getState().undo();
    expect(useEditor.getState().future).toHaveLength(1);

    useEditor.getState().commitPixels(painted(32, [[0, 0, 3]]));
    expect(useEditor.getState().future).toEqual([]);
  });
});

describe("undo and redo", () => {
  it("walks back and forward through edits", () => {
    useEditor.getState().commitPixels(painted(32, [[0, 0, 1]]));
    useEditor.getState().commitPixels(painted(32, [[1, 0, 2]]));

    useEditor.getState().undo();
    expect(useEditor.getState().pixels[0]).toBe(1);
    expect(useEditor.getState().pixels[1]).toBe(EMPTY_PIXEL);

    useEditor.getState().undo();
    expect(useEditor.getState().pixels[0]).toBe(EMPTY_PIXEL);

    useEditor.getState().redo();
    expect(useEditor.getState().pixels[0]).toBe(1);

    useEditor.getState().redo();
    expect(useEditor.getState().pixels[1]).toBe(2);
  });

  it("does nothing at the ends of the history", () => {
    expect(() => useEditor.getState().undo()).not.toThrow();
    expect(() => useEditor.getState().redo()).not.toThrow();
    expect(useEditor.getState().pixels[0]).toBe(EMPTY_PIXEL);
  });

  it("does not rewind tool, colour, or grid visibility", () => {
    useEditor.getState().setColorIndex(3);
    useEditor.getState().setTool("fill");
    useEditor.getState().toggleGrid();
    useEditor.getState().commitPixels(painted(32, [[0, 0, 1]]));

    useEditor.getState().undo();

    const state = useEditor.getState();
    expect(state.colorIndex).toBe(3);
    expect(state.tool).toBe("fill");
    expect(state.showGrid).toBe(false);

    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.colorIndex).toBe(3);
    expect(saved.showGrid).toBe(false);
  });

  it("caps history at 48 snapshots", () => {
    for (let i = 0; i < 50; i++) {
      useEditor.getState().commitPixels(painted(32, [[i, 0, i % 16]]));
    }
    expect(useEditor.getState().past).toHaveLength(48);
  });
});

describe("clear", () => {
  it("clears the canvas and allows undo", () => {
    useEditor.getState().commitPixels(painted(32, [[3, 3, 4]]));
    useEditor.getState().clear();

    expect(useEditor.getState().pixels.every((value) => value === EMPTY_PIXEL)).toBe(true);
    expect(useEditor.getState().past).toHaveLength(2);

    useEditor.getState().undo();
    expect(useEditor.getState().pixels[3 * 32 + 3]).toBe(4);
  });

  it("does nothing on an empty canvas", () => {
    useEditor.getState().clear();
    expect(useEditor.getState().past).toEqual([]);
  });
});

describe("loadDrawing", () => {
  it("loads pixels, resets history, and persists", () => {
    useEditor.getState().commitPixels(painted(32, [[0, 0, 1]]));
    const drawing = painted(16, [[2, 2, 6]]);

    useEditor.getState().loadDrawing(16, drawing);

    const state = useEditor.getState();
    expect(state.gridSize).toBe(16);
    expect(state.pixels).toHaveLength(16 * 16);
    expect(state.pixels[2 * 16 + 2]).toBe(6);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);

    drawing[2 * 16 + 2] = 1;
    expect(state.pixels[2 * 16 + 2]).toBe(6);

    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.gridSize).toBe(16);
    expect(saved.pixels).toHaveLength(16 * 16);
  });
});

describe("hydrate", () => {
  it("does nothing when there is no saved drawing", () => {
    useEditor.getState().hydrate();
    expect(useEditor.getState().gridSize).toBe(32);
  });

  it("restores a valid saved drawing", () => {
    const pixels = new Array(16 * 16).fill(EMPTY_PIXEL);
    pixels[2 * 16 + 3] = 7;
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gridSize: 16,
        pixels,
        colorIndex: 3,
        showGrid: false,
      }),
    );

    useEditor.getState().hydrate();

    const state = useEditor.getState();
    expect(state.gridSize).toBe(16);
    expect(state.pixels[2 * 16 + 3]).toBe(7);
    expect(state.colorIndex).toBe(3);
    expect(state.showGrid).toBe(false);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  it("defaults missing showGrid to true", () => {
    const pixels = new Array(8 * 8).fill(EMPTY_PIXEL);
    storage.setItem(STORAGE_KEY, JSON.stringify({ gridSize: 8, pixels }));
    useEditor.getState().hydrate();
    expect(useEditor.getState().showGrid).toBe(true);
  });

  it("sanitises out-of-range pixels and colour indexes", () => {
    const pixels = new Array(8 * 8).fill(-99);
    pixels[0] = 99;
    pixels[1] = 7;
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gridSize: 8, pixels, colorIndex: 99, showGrid: true }),
    );

    useEditor.getState().hydrate();

    expect(useEditor.getState().pixels[0]).toBe(EMPTY_PIXEL);
    expect(useEditor.getState().pixels[1]).toBe(7);
    expect(useEditor.getState().colorIndex).toBe(8);
  });

  it("ignores an unsupported grid size", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gridSize: 10, pixels: new Array(100).fill(EMPTY_PIXEL) }),
    );
    useEditor.getState().hydrate();
    expect(useEditor.getState().gridSize).toBe(32);
  });

  it("ignores a pixel array that does not match the grid", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gridSize: 8, pixels: new Array(10).fill(EMPTY_PIXEL) }),
    );
    useEditor.getState().hydrate();
    expect(useEditor.getState().gridSize).toBe(32);
  });

  it("ignores corrupt JSON", () => {
    storage.setItem(STORAGE_KEY, "{not json");
    expect(() => useEditor.getState().hydrate()).not.toThrow();
    expect(useEditor.getState().gridSize).toBe(32);
  });
});
