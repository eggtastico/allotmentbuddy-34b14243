import { describe, it, expect } from 'vitest';
import { estimatePhotoSize } from '../photoStorage';

describe('photoStorage utilities', () => {
  describe('estimatePhotoSize', () => {
    it('should estimate size of base64 data URL', () => {
      // 100 base64 chars ≈ 75 bytes
      const dataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(100);
      const size = estimatePhotoSize(dataUrl);
      expect(size).toBe(75);
    });

    it('should handle empty data URL', () => {
      const dataUrl = 'data:image/jpeg;base64,';
      const size = estimatePhotoSize(dataUrl);
      expect(size).toBe(0);
    });

    it('should handle large data URL', () => {
      const dataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(10000);
      const size = estimatePhotoSize(dataUrl);
      expect(size).toBe(7500);
    });
  });
});
