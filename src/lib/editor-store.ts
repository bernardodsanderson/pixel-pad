import { create } from "zustand";
import { DEFAULT_GRID_SIZE, EMPTY_PIXEL, GRID_SIZES, type GridSize } from "./palette";
import { clonePixels, createPixels, pixelsEqual, resizePixels } from "./pixel-utils";

export type Tool = "pencil" | "eraser" | "fill";

const STORAGE_KEY = "pixel-pad-v1";
const MAX_HISTORY = 48;

export interface EditorSnapshot {
  gridSize: GridSize;
  pixels: Int8Array;
  tool: Tool;
  colorIndex: number;
  showGrid: boolean;
}

interface EditorState extends EditorSnapshot {
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  setTool: (tool: Tool) => void;
  setColorIndex: (index: number) => void;
  toggleGrid: () => void;
  setGridSize: (size: GridSize) => void;
  commitPixels: (pixels: Int8Array) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  hydrate: () => void;
  loadDrawing: (gridSize: GridSize, pixels: Int8Array) => void;
}

type Persisted = {
  gridSize: number;
  pixels: number[];
  colorIndex: number;
  showGrid: boolean;
};

function isGridSize(value: number): value is GridSize {
  return (GRID_SIZES as readonly number[]).includes(value);
}

function capture(state: EditorSnapshot): EditorSnapshot {
  return {
    gridSize: state.gridSize,
    pixels: clonePixels(state.pixels),
    tool: state.tool,
    colorIndex: state.colorIndex,
    showGrid: state.showGrid,
  };
}

function persist(state: EditorSnapshot) {
  if (typeof window === "undefined") return;
  const payload: Persisted = {
    gridSize: state.gridSize,
    pixels: Array.from(state.pixels),
    colorIndex: state.colorIndex,
    showGrid: state.showGrid,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode — drawing still works in-memory.
  }
}

function pushHistory(past: EditorSnapshot[], current: EditorSnapshot): EditorSnapshot[] {
  const next = [...past, capture(current)];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

export const useEditor = create<EditorState>((set, get) => ({
  gridSize: DEFAULT_GRID_SIZE,
  pixels: createPixels(DEFAULT_GRID_SIZE),
  tool: "pencil",
  colorIndex: 8,
  showGrid: true,
  past: [],
  future: [],

  setTool: (tool) => set({ tool }),

  setColorIndex: (index) => {
    if (index < 0 || index > 15) return;
    set({ colorIndex: index });
  },

  toggleGrid: () => {
    const showGrid = !get().showGrid;
    set({ showGrid });
    persist({ ...get(), showGrid });
  },

  setGridSize: (size) => {
    const state = get();
    if (size === state.gridSize) return;
    const pixels = resizePixels(state.pixels, state.gridSize, size);
    const past = pushHistory(state.past, state);
    set({ gridSize: size, pixels, past, future: [] });
    persist({ ...get(), gridSize: size, pixels });
  },

  commitPixels: (pixels) => {
    const state = get();
    if (pixelsEqual(state.pixels, pixels)) return;
    const past = pushHistory(state.past, state);
    const next = clonePixels(pixels);
    set({ pixels: next, past, future: [] });
    persist({ ...get(), pixels: next });
  },

  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    const past = state.past.slice(0, -1);
    const future = [capture(state), ...state.future];
    set({
      gridSize: previous.gridSize,
      pixels: clonePixels(previous.pixels),
      past,
      future,
    });
    // Persist the canvas that is now on screen. Tool/colour/grid are view
    // preferences, so undo must not rewind them.
    persist(get());
  },

  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    const future = state.future.slice(1);
    const past = pushHistory(state.past, state);
    set({
      gridSize: next.gridSize,
      pixels: clonePixels(next.pixels),
      past,
      future,
    });
    persist(get());
  },

  clear: () => {
    const state = get();
    const pixels = createPixels(state.gridSize);
    if (pixelsEqual(state.pixels, pixels)) return;
    const past = pushHistory(state.past, state);
    set({ pixels, past, future: [] });
    persist({ ...get(), pixels });
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Persisted;
      if (!isGridSize(data.gridSize) || !Array.isArray(data.pixels)) return;
      if (data.pixels.length !== data.gridSize * data.gridSize) return;
      const pixels = new Int8Array(data.gridSize * data.gridSize);
      for (let i = 0; i < pixels.length; i++) {
        const value = data.pixels[i];
        pixels[i] =
          typeof value === "number" && value >= EMPTY_PIXEL && value <= 15 ? value : EMPTY_PIXEL;
      }
      const colorIndex =
        typeof data.colorIndex === "number" && data.colorIndex >= 0 && data.colorIndex <= 15
          ? data.colorIndex
          : 8;
      set({
        gridSize: data.gridSize,
        pixels,
        colorIndex,
        showGrid: data.showGrid !== false,
        past: [],
        future: [],
      });
    } catch {
      // Ignore a corrupt save.
    }
  },

  loadDrawing: (size, pixels) => {
    const next = clonePixels(pixels);
    set({
      gridSize: size,
      pixels: next,
      past: [],
      future: [],
    });
    persist({ ...get(), gridSize: size, pixels: next });
  },
}));
