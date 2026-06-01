import { describe, it, expect } from 'vitest';
import { snapToGrid } from '../gardenCanvasUtils';

/**
 * Pure coordinate→cell mapping extracted from GardenGrid. Guards the geometry
 * (snap flooring, sub-cell rounding, and clamping) independently of the DOM.
 */

const RECT0 = { left: 0, top: 0 };

describe('snapToGrid (snap = true)', () => {
  const cellSize = 32;
  const cols = 30;
  const rows = 20;

  it('floors a coordinate to its containing cell', () => {
    // 70px / 32 = 2.18 → cell 2; 100px / 32 = 3.125 → cell 3
    expect(snapToGrid(70, 100, RECT0, cellSize, cols, rows, true)).toEqual({ x: 2, y: 3 });
  });

  it('maps the cell origin exactly', () => {
    expect(snapToGrid(64, 32, RECT0, cellSize, cols, rows, true)).toEqual({ x: 2, y: 1 });
  });

  it('clamps to the grid bounds (never negative, never past cols/rows-1)', () => {
    expect(snapToGrid(-50, -50, RECT0, cellSize, cols, rows, true)).toEqual({ x: 0, y: 0 });
    // Far beyond the grid → clamped to last cell index
    expect(snapToGrid(99999, 99999, RECT0, cellSize, cols, rows, true)).toEqual({ x: cols - 1, y: rows - 1 });
  });

  it('subtracts the canvas rect offset before mapping', () => {
    // Same client point, but the canvas starts at (100, 50): local = (70, 100) → cell (2, 3)
    const rect = { left: 100, top: 50 };
    expect(snapToGrid(170, 150, rect, cellSize, cols, rows, true)).toEqual({ x: 2, y: 3 });
  });
});

describe('snapToGrid (snap = false)', () => {
  const cellSize = 32;
  const cols = 30;
  const rows = 20;

  it('rounds to one decimal place instead of flooring', () => {
    // 80 / 32 = 2.5 ; 112 / 32 = 3.5
    expect(snapToGrid(80, 112, RECT0, cellSize, cols, rows, false)).toEqual({ x: 2.5, y: 3.5 });
  });

  it('clamps before rounding', () => {
    expect(snapToGrid(-50, -50, RECT0, cellSize, cols, rows, false)).toEqual({ x: 0, y: 0 });
    expect(snapToGrid(99999, 99999, RECT0, cellSize, cols, rows, false)).toEqual({ x: cols - 1, y: rows - 1 });
  });
});
