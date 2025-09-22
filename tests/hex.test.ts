import { describe, it, expect } from 'vitest'
import { hexToU64, u64ToHex } from 'a5/core/hex'

describe('hex.ts', () => {
  describe('hexToU64', () => {
    it('converts hex strings to BigInt', () => {
      expect(hexToU64('1a2b3c')).toBe(BigInt(1715004));
      expect(hexToU64('0')).toBe(BigInt(0));
      expect(hexToU64('ff')).toBe(BigInt(255));
      expect(hexToU64('ffffffff')).toBe(BigInt(4294967295));
    });
  });

  describe('u64ToHex', () => {
    it('converts BigInt to hex strings', () => {
      expect(u64ToHex(BigInt(1715004))).toBe('1a2b3c');
      expect(u64ToHex(BigInt(0))).toBe('0');
      expect(u64ToHex(BigInt(255))).toBe('ff');
      expect(u64ToHex(BigInt(4294967295))).toBe('ffffffff');
    });
  });

  describe('round trip conversion', () => {
    it('preserves values when converting back and forth', () => {
      const testValues = ['1a2b3c', '0', 'ff', 'ffffffff'];
      
      for (const hexStr of testValues) {
        const bigInt = hexToU64(hexStr);
        const result = u64ToHex(bigInt);
        expect(result).toBe(hexStr);
      }
    });
  });
}); 