import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'allotment-buddy-favourite-plants';

// Test the localStorage parsing logic directly (extracted from the hook)
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((f: unknown) => {
        if (typeof f !== 'object' || f === null) return null;
        const row = f as Record<string, unknown>;
        const plantId = (typeof row.plantId === 'string' ? row.plantId : undefined) ||
                       (typeof row.plant_id === 'string' ? row.plant_id : undefined);
        const order = typeof row.order === 'number' ? row.order : 0;
        const quantity = typeof row.quantity === 'number' ? row.quantity : 0;
        if (!plantId) return null;
        return { plantId, order, quantity };
      })
      .filter((f: unknown): f is { plantId: string; order: number; quantity: number } => f !== null);
  } catch {
    return [];
  }
}

describe('useFavouritePlants localStorage logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return empty array when no data stored', () => {
    expect(loadFromStorage()).toEqual([]);
  });

  it('should parse valid favourite plants', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { plantId: 'tomato', order: 0, quantity: 5 },
      { plantId: 'carrot', order: 1, quantity: 3 },
    ]));

    const result = loadFromStorage();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ plantId: 'tomato', order: 0, quantity: 5 });
    expect(result[1]).toEqual({ plantId: 'carrot', order: 1, quantity: 3 });
  });

  it('should handle snake_case plant_id from Supabase format', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { plant_id: 'tomato', order: 0, quantity: 5 },
    ]));

    const result = loadFromStorage();
    expect(result).toHaveLength(1);
    expect(result[0].plantId).toBe('tomato');
  });

  it('should skip entries without plantId', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { plantId: 'tomato', order: 0, quantity: 5 },
      { order: 1, quantity: 3 }, // missing plantId
      { plantId: 'carrot', order: 2, quantity: 1 },
    ]));

    const result = loadFromStorage();
    expect(result).toHaveLength(2);
  });

  it('should default order and quantity to 0', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { plantId: 'tomato' },
    ]));

    const result = loadFromStorage();
    expect(result[0]).toEqual({ plantId: 'tomato', order: 0, quantity: 0 });
  });

  it('should handle invalid JSON gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    expect(loadFromStorage()).toEqual([]);
  });

  it('should handle non-array JSON gracefully', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ plantId: 'tomato' }));
    expect(loadFromStorage()).toEqual([]);
  });

  it('should handle null entries in array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([null, 'string', 42]));
    expect(loadFromStorage()).toEqual([]);
  });
});
