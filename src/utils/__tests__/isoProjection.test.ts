import { describe, it, expect } from 'vitest';
import {
  BASE_TILE_W,
  BASE_TILE_H,
  tileW,
  tileH,
  gridToScreen,
  gridToScreenCenter,
  screenToGrid,
  pointInDiamond,
  painterKey,
  clampGrid,
  cellNoise,
} from '../isoProjection';

// ─── helpers ────────────────────────────────────────────────────────────────

const ORIGIN_X = 200;
const ORIGIN_Y = 100;
const ZOOM = 1;
const Z2 = 2; // second zoom level for scaling checks

function approx(a: number, b: number, eps = 0.0001) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

// ─── tile dimensions ────────────────────────────────────────────────────────

describe('tileW / tileH', () => {
  it('returns BASE values at zoom=1', () => {
    expect(tileW(1)).toBe(BASE_TILE_W);
    expect(tileH(1)).toBe(BASE_TILE_H);
  });

  it('scales linearly with zoom', () => {
    expect(tileW(2)).toBe(BASE_TILE_W * 2);
    expect(tileH(0.5)).toBe(BASE_TILE_H * 0.5);
  });

  it('maintains 2:1 ratio', () => {
    [0.5, 1, 1.5, 2, 3].forEach(z => {
      expect(tileW(z) / tileH(z)).toBe(2);
    });
  });
});

// ─── gridToScreen ────────────────────────────────────────────────────────────

describe('gridToScreen', () => {
  it('maps origin cell to (originX, originY)', () => {
    const { sx, sy } = gridToScreen(0, 0, ZOOM, ORIGIN_X, ORIGIN_Y);
    expect(sx).toBe(ORIGIN_X);
    expect(sy).toBe(ORIGIN_Y);
  });

  it('+1 col shifts right by tileW/2, down by tileH/2', () => {
    const { sx: sx0, sy: sy0 } = gridToScreen(0, 0, ZOOM, ORIGIN_X, ORIGIN_Y);
    const { sx: sx1, sy: sy1 } = gridToScreen(1, 0, ZOOM, ORIGIN_X, ORIGIN_Y);
    approx(sx1 - sx0, tileW(ZOOM) / 2);
    approx(sy1 - sy0, tileH(ZOOM) / 2);
  });

  it('+1 row shifts left by tileW/2, down by tileH/2', () => {
    const { sx: sx0, sy: sy0 } = gridToScreen(0, 0, ZOOM, ORIGIN_X, ORIGIN_Y);
    const { sx: sx1, sy: sy1 } = gridToScreen(0, 1, ZOOM, ORIGIN_X, ORIGIN_Y);
    approx(sx1 - sx0, -(tileW(ZOOM) / 2));
    approx(sy1 - sy0, tileH(ZOOM) / 2);
  });

  it('scales with zoom', () => {
    const { sx: sx1, sy: sy1 } = gridToScreen(3, 2, ZOOM, 0, 0);
    const { sx: sx2, sy: sy2 } = gridToScreen(3, 2, Z2, 0, 0);
    approx(sx2 / sx1, Z2);
    approx(sy2 / sy1, Z2);
  });

  it('col=row means sx === originX (on the vertical centre axis)', () => {
    for (let n = 0; n < 5; n++) {
      const { sx } = gridToScreen(n, n, ZOOM, ORIGIN_X, ORIGIN_Y);
      approx(sx, ORIGIN_X);
    }
  });
});

// ─── gridToScreenCenter ───────────────────────────────────────────────────────

describe('gridToScreenCenter', () => {
  it('centre is tileH/2 below the top tip', () => {
    const tip = gridToScreen(2, 3, ZOOM, ORIGIN_X, ORIGIN_Y);
    const cen = gridToScreenCenter(2, 3, ZOOM, ORIGIN_X, ORIGIN_Y);
    expect(cen.sx).toBe(tip.sx);
    approx(cen.sy - tip.sy, tileH(ZOOM) / 2);
  });
});

// ─── screenToGrid ────────────────────────────────────────────────────────────

describe('screenToGrid', () => {
  it('round-trips with gridToScreen (top-tip positions)', () => {
    const cases: [number, number][] = [
      [0, 0], [1, 0], [0, 1], [3, 4], [10, 7],
    ];
    cases.forEach(([col, row]) => {
      const { sx, sy } = gridToScreen(col, row, ZOOM, ORIGIN_X, ORIGIN_Y);
      const { col: c2, row: r2 } = screenToGrid(sx, sy, ZOOM, ORIGIN_X, ORIGIN_Y);
      approx(c2, col);
      approx(r2, row);
    });
  });

  it('round-trips at zoom=2', () => {
    const { sx, sy } = gridToScreen(5, 3, Z2, ORIGIN_X, ORIGIN_Y);
    const { col, row } = screenToGrid(sx, sy, Z2, ORIGIN_X, ORIGIN_Y);
    approx(col, 5);
    approx(row, 3);
  });

  it('round-trips at fractional zoom', () => {
    const z = 1.5;
    const { sx, sy } = gridToScreen(4, 2, z, ORIGIN_X, ORIGIN_Y);
    const { col, row } = screenToGrid(sx, sy, z, ORIGIN_X, ORIGIN_Y);
    approx(col, 4);
    approx(row, 2);
  });
});

// ─── pointInDiamond ──────────────────────────────────────────────────────────

describe('pointInDiamond', () => {
  it('centre of cell is inside its diamond', () => {
    const { sx, sy } = gridToScreenCenter(3, 3, ZOOM, ORIGIN_X, ORIGIN_Y);
    expect(pointInDiamond(sx, sy, 3, 3, ZOOM, ORIGIN_X, ORIGIN_Y)).toBe(true);
  });

  it('top tip is inside (boundary)', () => {
    const { sx, sy } = gridToScreen(3, 3, ZOOM, ORIGIN_X, ORIGIN_Y);
    expect(pointInDiamond(sx, sy, 3, 3, ZOOM, ORIGIN_X, ORIGIN_Y)).toBe(true);
  });

  it('centre of adjacent cell is outside', () => {
    const { sx, sy } = gridToScreenCenter(4, 3, ZOOM, ORIGIN_X, ORIGIN_Y);
    expect(pointInDiamond(sx, sy, 3, 3, ZOOM, ORIGIN_X, ORIGIN_Y)).toBe(false);
  });

  it('far-away point is outside', () => {
    expect(pointInDiamond(9999, 9999, 0, 0, ZOOM, ORIGIN_X, ORIGIN_Y)).toBe(false);
  });
});

// ─── painterKey ──────────────────────────────────────────────────────────────

describe('painterKey', () => {
  it('back cells have smaller keys than front cells', () => {
    // (0,0) is furthest back, (5,5) is furthest front
    expect(painterKey(0, 0)).toBeLessThan(painterKey(5, 5));
  });

  it('same diagonal band: sorted by col ascending', () => {
    // col=0,row=4 and col=2,row=2 are both on diagonal 4
    expect(painterKey(0, 4)).toBeLessThan(painterKey(2, 2));
  });

  it('different bands always ordered by band first', () => {
    // diagonal 3 should always precede diagonal 5 regardless of col
    expect(painterKey(3, 0)).toBeLessThan(painterKey(0, 5));
  });

  it('is deterministic / pure', () => {
    expect(painterKey(7, 3)).toBe(painterKey(7, 3));
  });
});

// ─── clampGrid ───────────────────────────────────────────────────────────────

describe('clampGrid', () => {
  const W = 10;
  const H = 8;

  it('passes valid coordinates through unchanged', () => {
    expect(clampGrid(5, 3, W, H)).toEqual({ col: 5, row: 3 });
  });

  it('clamps negative values to 0', () => {
    expect(clampGrid(-3, -1, W, H)).toEqual({ col: 0, row: 0 });
  });

  it('clamps values >= grid size to last index', () => {
    expect(clampGrid(15, 10, W, H)).toEqual({ col: W - 1, row: H - 1 });
  });

  it('floors fractional coordinates', () => {
    const r = clampGrid(4.9, 2.7, W, H);
    expect(r.col).toBe(4);
    expect(r.row).toBe(2);
  });
});

// ─── cellNoise ───────────────────────────────────────────────────────────────

describe('cellNoise', () => {
  it('returns a value in [0, 1)', () => {
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 5; r++) {
        const v = cellNoise(c, r);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('is deterministic (same inputs → same output)', () => {
    expect(cellNoise(3, 7)).toBe(cellNoise(3, 7));
    expect(cellNoise(0, 0, 42)).toBe(cellNoise(0, 0, 42));
  });

  it('produces different values for different seeds', () => {
    const a = cellNoise(3, 7, 0);
    const b = cellNoise(3, 7, 1);
    expect(a).not.toBe(b);
  });

  it('distributes values reasonably (no extreme bias)', () => {
    const values: number[] = [];
    for (let c = 0; c < 20; c++) {
      for (let r = 0; r < 20; r++) {
        values.push(cellNoise(c, r));
      }
    }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    // Average should be roughly 0.5 for a well-distributed hash
    expect(avg).toBeGreaterThan(0.3);
    expect(avg).toBeLessThan(0.7);
  });
});
