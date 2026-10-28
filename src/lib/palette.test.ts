import { describe, expect, it } from "vitest";
import { DEFAULT_GRID_SIZE, EMPTY_PIXEL, GRID_SIZES, PALETTE, PALETTE_NAMES } from "./palette";

describe("PICO-8 palette", () => {
  it("has exactly 16 colours", () => {
    expect(PALETTE).toHaveLength(16);
    expect(PALETTE_NAMES).toHaveLength(16);
  });

  it("uses unique, valid hex colours", () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    for (const hex of PALETTE) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("keeps the canonical PICO-8 order", () => {
    expect(PALETTE[0]).toBe("#000000");
    expect(PALETTE[8]).toBe("#FF004D");
    expect(PALETTE[15]).toBe("#FFCCAA");
  });

  it("has a name for every colour", () => {
    for (const name of PALETTE_NAMES) {
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  it("offers only the supported grid sizes", () => {
    expect(GRID_SIZES).toEqual([8, 16, 24, 32, 48, 64]);
  });

  it("defaults to 32×32", () => {
    expect(DEFAULT_GRID_SIZE).toBe(32);
    expect(GRID_SIZES).toContain(DEFAULT_GRID_SIZE);
  });

  it("uses -1 for an empty pixel", () => {
    expect(EMPTY_PIXEL).toBe(-1);
  });
});
