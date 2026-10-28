/** Official PICO-8 16-color palette (lexaloffle). */
export const PALETTE = [
  "#000000",
  "#1D2B53",
  "#7E2553",
  "#008751",
  "#AB5236",
  "#5F574F",
  "#C2C3C7",
  "#FFF1E8",
  "#FF004D",
  "#FFA300",
  "#FFEC27",
  "#00E436",
  "#29ADFF",
  "#83769C",
  "#FF77A8",
  "#FFCCAA",
] as const;

export const PALETTE_NAMES = [
  "Black",
  "Dark Blue",
  "Dark Purple",
  "Dark Green",
  "Brown",
  "Dark Grey",
  "Light Grey",
  "White",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Lavender",
  "Pink",
  "Peach",
] as const;

export const GRID_SIZES = [8, 16, 24, 32, 48, 64] as const;

export type PaletteIndex = number;
export type GridSize = (typeof GRID_SIZES)[number];

export const DEFAULT_GRID_SIZE: GridSize = 32;
export const EMPTY_PIXEL = -1;
