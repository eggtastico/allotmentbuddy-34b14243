import { describe, it, expect } from 'vitest';

// Test the photo data validation logic extracted from useOfflineSync
function validatePhotoData(data: Record<string, unknown>) {
  const gardenId = typeof data.gardenId === 'string' ? data.gardenId : undefined;
  if (!gardenId) throw new Error('Photo sync: missing gardenId');

  return {
    garden_id: gardenId,
    plant_id: typeof data.plantId === 'string' ? data.plantId : null,
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    width: typeof data.width === 'number' ? data.width : null,
    height: typeof data.height === 'number' ? data.height : null,
  };
}

describe('useOfflineSync photo data validation', () => {
  it('should validate complete photo data', () => {
    const data = {
      gardenId: 'garden-123',
      plantId: 'plant-456',
      timestamp: 1234567890,
      width: 1024,
      height: 768,
    };

    const result = validatePhotoData(data);
    expect(result.garden_id).toBe('garden-123');
    expect(result.plant_id).toBe('plant-456');
    expect(result.timestamp).toBe(1234567890);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });

  it('should throw when gardenId is missing', () => {
    const data = { plantId: 'plant-456', timestamp: 1234567890 };
    expect(() => validatePhotoData(data)).toThrow('missing gardenId');
  });

  it('should throw when gardenId is wrong type', () => {
    const data = { gardenId: 123, plantId: 'plant-456' };
    expect(() => validatePhotoData(data)).toThrow('missing gardenId');
  });

  it('should handle missing optional fields', () => {
    const data = { gardenId: 'garden-123' };
    const result = validatePhotoData(data);
    expect(result.garden_id).toBe('garden-123');
    expect(result.plant_id).toBeNull();
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(typeof result.timestamp).toBe('number');
  });

  it('should handle wrong types for optional fields', () => {
    const data = {
      gardenId: 'garden-123',
      plantId: 42,
      timestamp: 'not-a-number',
      width: '1024',
      height: true,
    };

    const result = validatePhotoData(data);
    expect(result.plant_id).toBeNull();
    expect(typeof result.timestamp).toBe('number'); // Falls back to Date.now()
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });
});
