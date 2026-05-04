/**
 * Isometric projection utilities — pure math, no DOM/canvas dependencies.
 *
 * Coordinate convention:
 *   col  = grid X axis (left → right in screen space when row is fixed)
 *   row  = grid Y axis (top → bottom in screen space when col is fixed)
 *
 * Screen origin (sx=0, sy=0) is the canvas top-left.
 * The grid origin point (col=0, row=0) maps to (originX, originY) on screen.
 *
 * Tile geometry (at zoom=1):
 *   ◆  width  = BASE_TILE_W  (64px) — full diamond width (left tip → right tip)
 *   ◆  height = BASE_TILE_H  (32px) — full diamond height (top tip → bottom tip)
 *
 * The 2:1 ratio means every +1 col shifts the diamond +32px right, +16px down,
 * and every +1 row shifts the diamond -32px left (screen), +16px down.
 */

export const BASE_TILE_W = 64; // pixels at zoom=1
export const BASE_TILE_H = 32; // pixels at zoom=1

/** Scaled tile width at a given zoom level */
export function tileW(zoom: number): number {
  return BASE_TILE_W * zoom;
}

/** Scaled tile height at a given zoom level */
export function tileH(zoom: number): number {
  return BASE_TILE_H * zoom;
}

/**
 * Grid → screen: returns the screen position of the TOP TIP of the diamond
 * at (col, row).
 */
export function gridToScreen(
  col: number,
  row: number,
  zoom: number,
  originX: number,
  originY: number
): { sx: number; sy: number } {
  const tw = tileW(zoom);
  const th = tileH(zoom);
  return {
    sx: originX + (col - row) * (tw / 2),
    sy: originY + (col + row) * (th / 2),
  };
}

/**
 * Grid → screen: returns the screen position of the CENTRE of the diamond
 * at (col, row).  The centre is half a tile-height below the top tip.
 */
export function gridToScreenCenter(
  col: number,
  row: number,
  zoom: number,
  originX: number,
  originY: number
): { sx: number; sy: number } {
  const { sx, sy } = gridToScreen(col, row, zoom, originX, originY);
  return { sx, sy: sy + tileH(zoom) / 2 };
}

/**
 * Screen → grid: converts a screen position (mx, my) to floating-point grid
 * coordinates.  Round the result to get the nearest integer cell.
 *
 * Derivation (at zoom=1, originX=0, originY=0):
 *   sx = (col - row) * tw/2   →  col - row = sx / (tw/2)
 *   sy = (col + row) * th/2   →  col + row = sy / (th/2)
 *   ⟹  col = (sx/(tw/2) + sy/(th/2)) / 2
 *       row = (sy/(th/2) - sx/(tw/2)) / 2
 */
export function screenToGrid(
  mx: number,
  my: number,
  zoom: number,
  originX: number,
  originY: number
): { col: number; row: number } {
  const tw = tileW(zoom);
  const th = tileH(zoom);
  // Translate so origin is at (0,0)
  const rx = mx - originX;
  const ry = my - originY;
  return {
    col: rx / (tw / 2) / 2 + ry / (th / 2) / 2,
    row: ry / (th / 2) / 2 - rx / (tw / 2) / 2,
  };
}

/**
 * Hit-test: returns true if the screen point (px, py) falls inside the diamond
 * for grid cell (col, row).
 *
 * A point (lx, ly) relative to the diamond centre is inside when:
 *   |lx / (tw/2)| + |ly / (th/2)| ≤ 1
 */
export function pointInDiamond(
  px: number,
  py: number,
  col: number,
  row: number,
  zoom: number,
  originX: number,
  originY: number
): boolean {
  const { sx, sy } = gridToScreenCenter(col, row, zoom, originX, originY);
  const lx = px - sx;
  const ly = py - sy;
  const hw = tileW(zoom) / 2;
  const hh = tileH(zoom) / 2;
  return Math.abs(lx / hw) + Math.abs(ly / hh) <= 1;
}

/**
 * Painter sort key: cells with lower keys must be drawn first (further back).
 * In isometric view, cells with smaller col+row sum appear further from the
 * viewer — we sort ascending so back cells are drawn before front cells.
 *
 * Tie-breaking: within the same diagonal band we sort by col ascending
 * (left-to-right within the band doesn't matter visually, but we need a
 * stable order to avoid flickering).
 *
 * The key is: (col + row) * BIG_NUMBER + col
 * Using 10000 as BIG_NUMBER is safe for grids up to 10000 cells wide.
 */
export function painterKey(col: number, row: number): number {
  return (col + row) * 10000 + col;
}

/**
 * Clamp grid coordinates to valid bounds.
 */
export function clampGrid(
  col: number,
  row: number,
  gridW: number,
  gridH: number
): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(Math.floor(col), gridW - 1)),
    row: Math.max(0, Math.min(Math.floor(row), gridH - 1)),
  };
}

/**
 * Deterministic noise for soil texture — no Math.random().
 * Returns a value in [0, 1) based on (col, row, seed).
 */
export function cellNoise(col: number, row: number, seed = 0): number {
  // Simple integer hash: Wang hash variant
  let h = ((col * 1619) ^ (row * 31337) ^ (seed * 1000003)) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}
